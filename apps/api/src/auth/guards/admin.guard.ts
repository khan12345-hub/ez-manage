import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SystemRole } from 'generated/prisma/enums';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const sessionUser = req.session?.user;

    if (sessionUser?.systemRole !== SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required.');
    }

    return true;
  }
}
