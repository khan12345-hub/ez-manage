import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageProvider, UploadedFileResult } from './storage.types';

/**
 * Bunny.net Storage provider.
 *
 * Env vars required:
 *   BUNNY_STORAGE_ZONE   — storage zone name  (e.g. "ez-manage")
 *   BUNNY_API_KEY        — storage zone password / API key
 *   BUNNY_CDN_URL        — pull-zone base URL  (e.g. "https://ez-manage.b-cdn.net")
 *
 * Optional:
 *   BUNNY_STORAGE_ENDPOINT — regional endpoint (default: https://storage.bunnycdn.com)
 *                            Use https://uk.storage.bunnycdn.com  for UK region
 *                            Use https://de.storage.bunnycdn.com  for DE region
 *                            Use https://sg.storage.bunnycdn.com  for SG region
 *                            Use https://ny.storage.bunnycdn.com  for NY region
 *                            Use https://la.storage.bunnycdn.com  for LA region
 */
@Injectable()
export class BunnyStorageService implements StorageProvider {
  private readonly logger = new Logger(BunnyStorageService.name);

  private readonly storageZone = process.env.BUNNY_STORAGE_ZONE ?? '';
  private readonly apiKey      = process.env.BUNNY_API_KEY      ?? '';
  private readonly cdnUrl      = (process.env.BUNNY_CDN_URL     ?? '').replace(/\/$/, '');
  private readonly endpoint    = (process.env.BUNNY_STORAGE_ENDPOINT ?? 'https://storage.bunnycdn.com').replace(/\/$/, '');

  async upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult> {
    const ext        = file.originalname.split('.').pop();
    const storageKey = `${folder}/${randomUUID()}.${ext}`;
    const url        = `${this.endpoint}/${this.storageZone}/${storageKey}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey:      this.apiKey,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      body: file.buffer as unknown as BodyInit,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bunny.net upload failed [${res.status}]: ${body}`);
    }

    this.logger.debug(`Uploaded ${storageKey} to Bunny.net`);

    return {
      storageKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const url = `${this.endpoint}/${this.storageZone}/${storageKey}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: this.apiKey },
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`Bunny.net delete failed [${res.status}]: ${body}`);
    }
  }

  getUrl(storageKey: string): string {
    return `${this.cdnUrl}/${storageKey}`;
  }
}
