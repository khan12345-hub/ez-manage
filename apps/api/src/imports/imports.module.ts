import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, LocalStorageService, BoardAccessService],
})
export class ImportsModule {}
