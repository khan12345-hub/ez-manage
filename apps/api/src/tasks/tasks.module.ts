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
import { AutomationEngineService } from 'src/automations/automation-engine.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
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
    AutomationEngineService,
  ],
})
export class TasksModule {}
