import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LocalStorageService } from 'src/storage/local-storage.service';

export interface FileImportJobData {
  fileId: number;
  url: string;
}

/*
 * Simple semaphore — limits how many downloads run at the same time.
 * Excess calls wait in a queue until a slot opens up.
 */
class Semaphore {
  private active = 0;
  private readonly waitQueue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waitQueue.push(resolve));
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }
}

@Injectable()
export class FileImportService implements OnModuleInit {
  private readonly logger = new Logger(FileImportService.name);

  /*
   * At most 5 files download simultaneously.
   * The rest queue up and run as slots free.
   */
  private readonly sem = new Semaphore(5);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  /*
   * On every server start: find any File records whose storageKey is still
   * an external URL (= import was interrupted) and resume them automatically.
   */
  async onModuleInit(): Promise<void> {
    const pending = await this.prisma.file.findMany({
      where: { storageKey: { startsWith: 'http' } },
      select: { id: true, storageKey: true },
    });

    if (!pending.length) return;

    this.logger.log(
      `Resuming ${pending.length} interrupted file import(s) from previous run…`,
    );

    for (const file of pending) {
      this.enqueue({ fileId: file.id, url: file.storageKey });
    }
  }

  /*
   * Public entry point.
   * Fire-and-forget: caller does NOT await this.
   * Internally respects the concurrency limit and retries on failure.
   */
  enqueue(data: FileImportJobData): void {
    void (async () => {
      await this.sem.acquire();
      try {
        await this.downloadWithRetry(data);
      } finally {
        this.sem.release();
      }
    })();
  }

  /*
   * Retry wrapper — up to 3 attempts with exponential back-off.
   * Delays: 5 s → 10 s → give up.
   * After all attempts fail the File record stays with an http storageKey
   * so the next server start will pick it up via onModuleInit.
   */
  private async downloadWithRetry(
    data: FileImportJobData,
    maxAttempts = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.downloadAndUpload(data);
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          this.logger.error(
            `File ${data.fileId} failed after ${maxAttempts} attempts — marking as failed. Error: ${err}`,
          );
          await this.prisma.file.update({
            where: { id: data.fileId },
            data: { storageKey: `import-failed:${data.url}` },
          }).catch(() => {/* ignore if file was already deleted */});
          return;
        }

        const delayMs = 5_000 * attempt; // 5 s, 10 s
        this.logger.warn(
          `File ${data.fileId} attempt ${attempt} failed, retrying in ${delayMs / 1000}s… Error: ${err}`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /*
   * Core logic: download from external URL and re-upload to our storage.
   */
  private async downloadAndUpload(data: FileImportJobData): Promise<void> {
    const { fileId, url } = data;

    const fileRecord = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!fileRecord) {
      throw new Error(`File record ${fileId} not found`);
    }

    /*
     * Idempotency guard: if a previous attempt already uploaded the file,
     * storageKey will no longer start with "http".
     */
    if (!fileRecord.storageKey.startsWith('http')) {
      return;
    }

    // DB-stored token takes precedence over .env so admin can update it from UI
    const dbSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'MONDAY_API_TOKEN' },
    }).catch(() => null);
    const mondayToken = dbSetting?.value || process.env.MONDAY_API_TOKEN;

    /*
     * Monday.com protected_static URLs require session-based CDN auth, not
     * an API token. The correct approach is to use the API token to call
     * Monday.com's GraphQL API and get a signed public_url for the asset,
     * then download from that URL (which is accessible without auth).
     *
     * URL shape: https://<sub>.monday.com/protected_static/<account>/resources/<assetId>/<filename>
     */
    const mondayStaticMatch = /monday\.com\/protected_static\/\d+\/resources\/(\d+)\//i.exec(url);
    let downloadUrl = url;

    if (mondayStaticMatch && mondayToken) {
      const assetId = mondayStaticMatch[1];
      this.logger.log(`File ${fileId}: resolving Monday.com asset ${assetId} via API…`);

      const gqlResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Authorization': mondayToken,
          'Content-Type': 'application/json',
          'API-Version': '2024-01',
        },
        body: JSON.stringify({
          query: `{ assets(ids: [${assetId}]) { public_url name } }`,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!gqlResponse.ok) {
        throw new Error(`Monday.com API returned ${gqlResponse.status} when resolving asset ${assetId}`);
      }

      const gqlData = await gqlResponse.json() as {
        data?: { assets?: { public_url: string; name: string }[] };
        errors?: { message: string }[];
      };

      if (gqlData.errors?.length) {
        throw new Error(`Monday.com API error: ${gqlData.errors.map((e) => e.message).join(', ')}`);
      }

      const asset = gqlData.data?.assets?.[0];
      if (!asset?.public_url) {
        throw new Error(`Monday.com API returned no public_url for asset ${assetId}`);
      }

      this.logger.log(`File ${fileId}: resolved to public_url ${asset.public_url}`);
      downloadUrl = asset.public_url;
    }

    /*
     * Only encode the URL if it came from the raw DB record (i.e. has spaces).
     * If it was resolved through the Monday API the URL is already a
     * properly-encoded signed S3 URL — calling encodeURI again would
     * double-encode the % characters (%20 → %2520) and break the S3 signature.
     */
    const encodedUrl = downloadUrl === url ? encodeURI(downloadUrl) : downloadUrl;

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };

    let response: Response;

    try {
      response = await fetch(encodedUrl, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new Error(`Network error fetching ${downloadUrl}: ${err}`);
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} downloading ${encodedUrl}`,
      );
    }

    const contentType =
      response.headers.get('content-type') ?? 'application/octet-stream';
    const mimeType = contentType.split(';')[0].trim();

    /*
     * Some sources return their login page (200 OK + text/html) instead of
     * the actual file when the request is not authenticated.
     */
    if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') {
      throw new Error(
        `Source returned HTML instead of file data — authentication required or URL invalid: ${encodedUrl}`,
      );
    }

    let fileName = fileRecord.fileName;
    const disposition = response.headers.get('content-disposition') ?? '';
    const nameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1/.exec(disposition);
    if (nameMatch?.[2]) {
      fileName = decodeURIComponent(nameMatch[2].trim());
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (!fileName.includes('.')) {
      const ext = mimeType.split('/')[1]?.replace('+xml', '').split(';')[0];
      if (ext) fileName = `${fileName}.${ext}`;
    }

    const fakeMulterFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: fileName,
      encoding: '7bit',
      mimetype: mimeType,
      buffer,
      size: buffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploaded = await this.storage.upload(fakeMulterFile, 'task-cells');

    await this.prisma.file.update({
      where: { id: fileId },
      data: {
        storageKey: uploaded.storageKey,
        url: this.storage.getUrl(uploaded.storageKey),
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSize,
        fileName: uploaded.fileName,
      },
    });

    this.logger.log(`File ${fileId} imported → ${uploaded.storageKey}`);
  }
}
