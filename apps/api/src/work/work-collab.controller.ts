import { BadRequestException, Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkCollabService, type CollabKind } from './work-collab.service';

const KIND: Record<string, CollabKind> = { docs: 'doc', whiteboards: 'board' };

/**
 * Live co-editing of Work Docs and Whiteboards (session auth is global):
 * POST /work/{docs|whiteboards}/:uid/collab/{join|update|awareness|leave}
 */
@SkipThrottle() // editors send small batches of keystrokes many times a minute
@Controller('work')
export class WorkCollabController {
  constructor(private readonly collab: WorkCollabService) {}

  @Post(':kind/:uid/collab/:action')
  @HttpCode(200)
  async act(@Param('kind') kind: string, @Param('uid') uid: string, @Param('action') action: string, @Body() b: any, @CurrentUser() u: SessionUser) {
    const k = KIND[kind];
    if (!k) throw new BadRequestException('Unknown page type.');
    const body = b ?? {};
    switch (action) {
      case 'join': return this.collab.join(k, uid, u.id, String(body.clientId ?? ''));
      case 'update': return this.collab.update(k, uid, u.id, body);
      case 'awareness': return this.collab.awareness(k, uid, u.id, body);
      case 'leave': return this.collab.leave(k, uid, u.id, body);
      default: throw new BadRequestException('Unknown action.');
    }
  }
}
