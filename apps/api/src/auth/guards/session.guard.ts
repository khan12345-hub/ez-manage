import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express-session';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {

  constructor(
    private reflector:Reflector
  ){}
  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [
        context.getHandler(),
        context.getClass()
      ]
    )
    if(isPublic){
      return true
    }
    const req = context.switchToHttp().getRequest<Request>();

    if (!req.session?.user) {
      throw new UnauthorizedException('Not authenticated.');
    }

    req.user = req.session.user;

    return true;
  }
}