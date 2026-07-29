import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [AuthModule, DatabaseModule, UsersModule, InvitationsModule, WorkspaceModule, BoardsModule, GroupsModule, TasksModule, ColumnsModule, CellsModule, CommentsModule,
    StatusOptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide:APP_GUARD,
      useClass:SessionAuthGuard
    }
  ],
})
export class AppModule {}
