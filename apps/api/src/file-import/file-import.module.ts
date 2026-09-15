import { Module } from '@nestjs/common';
import { FileImportService } from './file-import.processor';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [FileImportService],
  exports: [FileImportService],
})
export class FileImportModule {}
