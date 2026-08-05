import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { TaskCreateService } from './task-create.service';
import { TaskReorderService } from './task-reorder.service';
import { TaskQueryService } from './task-search.service';
import { TaskMutationService } from './task-mutation.service';
import { TaskBulkActionsService } from './tasks-bulk-actions.service';

@Module({
  controllers: [TasksController],
  providers: [
    TaskCreateService,
    TaskReorderService,
    TaskQueryService,
    TaskMutationService,
    TaskBulkActionsService,
    PrismaService,
    BoardAccessService,
    ActivityLogsService,
  ],
})
export class TasksModule {}
