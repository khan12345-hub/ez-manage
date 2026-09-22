import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { InvitationsModule } from './invitations/invitations.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { BoardsModule } from './boards/boards.module';
import { SessionAuthGuard } from './auth/guards/session.guard';
import { GroupsModule } from './groups/groups.module';
import { TasksModule } from './tasks/tasks.module';
import { ColumnsModule } from './columns/columns.module';
import { UsersModule } from './users/users.module';
import { CellsModule } from './cells/cells.module';
import { CommentsModule } from './comments/comments.module';
import { StatusOptionsModule } from './status-options/status-options.module';
import { ImportsModule } from './imports/imports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { GlobalSearchModule } from './global-search/global-search.module';
import { BoardFormsModule } from './board-forms/board-forms.module';
import { PublicBoardFormsModule } from './public-board-forms/public-board-forms.module';
import { BoardTemplatesModule } from './board-templates/board-templates.module';
import { AutomationsModule } from './automations/automations.module';
import { BoardDocumentsModule } from './board-documents/board-documents.module';
import { AdminModule } from './admin/admin.module';
import { TimeTrackingModule } from './time-tracking/time-tracking.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { FileCommentsModule } from './file-comments/file-comments.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 120 },   // 120 req/min globally
        { name: 'auth',    ttl: 60_000, limit: 10  },   // 10 req/min on auth routes
      ],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    DatabaseModule,
    UsersModule,
    InvitationsModule,
    WorkspaceModule,
    BoardsModule,
    GroupsModule,
    TasksModule,
    ColumnsModule,
    CellsModule,
    CommentsModule,
    StatusOptionsModule,
    ImportsModule,
    NotificationsModule,
    ActivityLogsModule,
    GlobalSearchModule,
    BoardFormsModule,
    PublicBoardFormsModule,
    BoardTemplatesModule,
    AutomationsModule,
    BoardDocumentsModule,
    AdminModule,
    TimeTrackingModule,
    WhatsappModule,
    FileCommentsModule,
    ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [AppService],
})
export class AppModule {
  constructor() {}
}
