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

@Module({
  imports: [AuthModule, DatabaseModule, InvitationsModule, WorkspaceModule, BoardsModule],
  controllers: [AppController],
  providers: [AppService,
    {
      provide:APP_GUARD,
      useClass:SessionAuthGuard
    }
  ],
})
export class AppModule {}
