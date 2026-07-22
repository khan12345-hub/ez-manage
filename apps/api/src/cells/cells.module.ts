import { Module } from '@nestjs/common';
import { CellsService } from './cells.service';
import { CellsController } from './cells.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports:[StorageModule],
  controllers: [CellsController],
  providers: [CellsService, PrismaService, BoardAccessService],
})
export class CellsModule {}
