import { Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ChatModule } from 'src/chat/chat.module';
import { CellsModule } from 'src/cells/cells.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { WorkModule } from 'src/work/work.module';
import { BoardAccessService } from 'src/boards/board-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { AutomationEngineService } from 'src/automations/automation-engine.service';
import { TaskCreateService } from 'src/tasks/task-create.service';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { ChatAccessGuard } from 'src/chat/chat-access.guard';
import { BoardsChatTasksService } from './boards-chat-tasks.service';
import { BoardsChatTasksController } from './boards-chat-tasks.controller';

/** Accounts & Invoices (Boards) team chat → tasks; kept apart from Company Work's chat. */
@Module({
  imports: [ChatModule, CellsModule, NotificationsModule, WorkModule],
  controllers: [BoardsChatTasksController],
  providers: [BoardsChatTasksService, PrismaService, BoardAccessService, ActivityLogsService, AutomationEngineService, TaskCreateService, WorkspaceService, ChatAccessGuard],
  exports: [BoardsChatTasksService],
})
export class BoardsChatTasksModule {}
