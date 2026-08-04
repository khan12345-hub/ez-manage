import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { InvitationsModule } from './invitations/invitations.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { BoardsModule } from './boards/boards.module';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
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
    ActivityLogsModule 
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
  exports: [AppService],
})
export class AppModule {
  constructor() {
   
  }
}
