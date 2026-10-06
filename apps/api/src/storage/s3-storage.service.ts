import { Injectable, Logger } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'node:crypto';
import { StorageProvider, UploadedFileResult } from './storage.types';

@Injectable()
export class S3StorageService implements StorageProvider {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    const region = process.env.AWS_REGION ?? 'us-east-1';
    const endpoint = process.env.AWS_S3_ENDPOINT;

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    this.baseUrl =
      process.env.AWS_S3_PUBLIC_URL ??
      `https://${this.bucket}.s3.${region}.amazonaws.com`;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<UploadedFileResult> {
    const ext = file.originalname.split('.').pop();
    const storageKey = `${folder}/${randomUUID()}.${ext}`;

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentDisposition: `inline; filename="${file.originalname}"`,
      },
    });

    await upload.done();
    this.logger.debug(`Uploaded ${storageKey} to S3`);

    return {
      storageKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }

  getUrl(storageKey: string): string {
    return `${this.baseUrl}/${storageKey}`;
  }
}
