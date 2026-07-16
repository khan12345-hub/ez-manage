import { Module } from '@nestjs/common';
import { CellsService } from './cells.service';
import { CellsController } from './cells.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [CellsController],
  providers: [CellsService, PrismaService, BoardAccessService],
})
export class CellsModule {}
