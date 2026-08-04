import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { TaskCreateService } from './task-create.service';
import { TaskReorderService } from './task-reorder.service';
import { TaskQueryService } from './task-search.service';
import { TaskMutationService } from './task-mutation.service';

@Module({
  controllers: [TasksController],
  providers: [
    TasksService,
    TaskCreateService,
    TaskReorderService,
    TaskQueryService,
    TaskMutationService,
    PrismaService,
    BoardAccessService,
    ActivityLogsService,
  ],
})
export class TasksModule {}
