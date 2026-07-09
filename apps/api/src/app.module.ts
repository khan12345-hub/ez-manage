import { Module } from '@nestjs/common';
// import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { InvitationsModule } from './invitations/invitations.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { BoardsModule } from './boards/boards.module';

@Module({
  imports: [AuthModule, DatabaseModule, InvitationsModule, WorkspaceModule, BoardsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
