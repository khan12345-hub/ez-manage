import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { PushService } from './push.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Public()
  @Get('vapid-public-key')
  getVapidKey() {
    return { key: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  subscribe(
    @CurrentUser() user: SessionUser,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    return this.pushService.subscribe(user.id, body);
  }

  @Delete('unsubscribe')
  unsubscribe(
    @CurrentUser() user: SessionUser,
    @Body() body: { endpoint: string },
  ) {
    return this.pushService.unsubscribe(user.id, body.endpoint);
  }
}
