import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, PrismaService, BoardAccessService, ActivityLogsService],
})
export class TasksModule {}
