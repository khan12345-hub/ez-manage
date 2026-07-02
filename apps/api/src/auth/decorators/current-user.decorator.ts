import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '../types/session-user.type';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest();

    return request.session.user;
  },
);
