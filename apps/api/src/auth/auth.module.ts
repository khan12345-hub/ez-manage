import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { SessionAuthGuard } from './guards/session.guard';
import { BoardAccessService } from 'src/boards/board-access.service';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardPermissionGuard } from './guards/board-permission.guard';
import { WorkspacePermissionGuard } from './guards/workspace-permission.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    SessionAuthGuard,
    BoardAccessService,
    WorkspaceAccessService,
    BoardPermissionGuard,
    WorkspacePermissionGuard,
  ],
  exports: [
    SessionAuthGuard,
    BoardAccessService,
    WorkspaceAccessService,
    BoardPermissionGuard,
    WorkspacePermissionGuard,
  ],
})
export class AuthModule {}
