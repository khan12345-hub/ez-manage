import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { WorkspaceAccessService } from '../../workspace/workspace-access.service';
import { WORKSPACE_PERMISSION_KEY } from '../decorators/require-workspace-permission.decorator';

@Injectable()
export class WorkspacePermissionGuard
  implements CanActivate
{
  constructor(
    private reflector: Reflector,
    private workspaceAccess: WorkspaceAccessService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const permission =
      this.reflector.getAllAndOverride(
        WORKSPACE_PERMISSION_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!permission) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest();

    const workspaceId = Number(
      request.params.workspaceId ??
      request.params.id,
    );

    const userId = request.user.id;

    return this.workspaceAccess.requirePermission(
      workspaceId,
      userId,
      permission,
    );
  }
}