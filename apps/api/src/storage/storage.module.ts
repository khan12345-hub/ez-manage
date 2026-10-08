import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { BunnyStorageService } from './bunny-storage.service';
import { StorageProvider } from './storage.types';

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

@Module({
  providers: [
    LocalStorageService,
    S3StorageService,
    BunnyStorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: (
        local: LocalStorageService,
        s3: S3StorageService,
        bunny: BunnyStorageService,
      ): StorageProvider => {
        if (process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_API_KEY) {
          return bunny;
        }
        if (process.env.AWS_S3_BUCKET) {
          return s3;
        }
        return local;
      },
      inject: [LocalStorageService, S3StorageService, BunnyStorageService],
    },
  ],
  exports: [LocalStorageService, STORAGE_SERVICE],
})
export class StorageModule {}
