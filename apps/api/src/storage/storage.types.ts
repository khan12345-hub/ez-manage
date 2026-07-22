export interface UploadedFileResult {
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface StorageProvider {
  upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedFileResult>;

  delete(
    storageKey: string,
  ): Promise<void>;

  getUrl(
    storageKey: string,
  ): string;
}