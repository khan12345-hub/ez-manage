import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { BOARD_PERMISSION_KEY } from '../decorators/require-board-permission.decorator';
import { BoardAccessService } from '../../boards/board-access.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BoardPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly boardAccess: BoardAccessService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveBoardId(rawParam: string): Promise<number | null> {
    const num = parseInt(rawParam, 10);
    if (Number.isInteger(num) && num > 0 && String(num) === rawParam) return num;
    const board = await this.prisma.board.findUnique({
      where: { uid: rawParam },
      select: { id: true },
    });
    return board?.id ?? null;
  }

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

    const rawParam = request.params.boardId ?? request.params.id;
    const boardId = await this.resolveBoardId(String(rawParam));
    if (!boardId) return false;

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    // SUPER_ADMIN is handled inside requirePermission, which reads the role
    // from the database (with deletedAt: null). Trusting the role stored in
    // the session let a deleted/demoted super admin keep full access until
    // their session expired.
    return this.boardAccess.requirePermission(
      boardId,
      user.id,
      permission,
    );
  }
}