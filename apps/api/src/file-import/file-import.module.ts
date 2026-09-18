import { Module } from '@nestjs/common';
import { FileImportService } from './file-import.processor';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [StorageModule, NotificationsModule],
  providers: [FileImportService],
  exports: [FileImportService],
})
export class FileImportModule {}
