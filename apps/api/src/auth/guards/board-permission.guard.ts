import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { BOARD_PERMISSION_KEY } from '../decorators/require-board-permission.decorator';
import { BoardAccessService } from '../../boards/board-access.service';
import { SystemRole } from 'generated/prisma/enums';

@Injectable()
export class BoardPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly boardAccess: BoardAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride(
      BOARD_PERMISSION_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    const boardId = Number(
      request.params.boardId ??
      request.params.id,
    );
    
    const user = request.user;

     if (!user) {
      throw new UnauthorizedException();
    }

    // SUPER ADMIN BYPASS
    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      return true;
    }

    return this.boardAccess.requirePermission(
      boardId,
      user.id,
      permission,
    );
  }
}