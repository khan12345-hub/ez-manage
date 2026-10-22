import { Module } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { ColumnsController } from './columns.controller';
import { PrismaService } from 'prisma/prisma.service';
import { ColumnsAccessService } from '../boards/update-column-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [ColumnsController],
  providers: [ColumnsService, PrismaService, ColumnsAccessService, ActivityLogsService, BoardAccessService],
})
export class ColumnsModule {}
