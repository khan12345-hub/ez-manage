import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { SessionAuthGuard } from './guards/session.guard';
import { BoardAccessService } from 'src/boards/board-access.service';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { BoardPermissionGuard } from './guards/board-permission.guard';
import { WorkspacePermissionGuard } from './guards/workspace-permission.guard';
import { MailModule } from 'src/mail/mail.module';
import { ChatModule } from 'src/chat/chat.module';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';

@Module({
  imports: [MailModule, ChatModule],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    AuthRepository,
    SessionAuthGuard,
    MfaService,
    BoardAccessService,
    WorkspaceAccessService,
    WorkspaceService,
    BoardPermissionGuard,
    WorkspacePermissionGuard,
  ],
  exports: [
    SessionAuthGuard,
    BoardAccessService,
    WorkspaceAccessService,
    WorkspaceService,
    BoardPermissionGuard,
    WorkspacePermissionGuard,
  ],
})
export class AuthModule {}
