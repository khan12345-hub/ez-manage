import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CalendarService } from './calendar.service';

/** CEO Tower calendar: read-only Google Calendar accounts (Administrators only, checked in the service). */
@Controller('calendar')
export class CalendarController {
  constructor(private readonly cal: CalendarService) {}

  @Get('accounts') accounts(@CurrentUser() u: SessionUser) { return this.cal.accounts(u.id); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google/connect') connect(@CurrentUser() u: SessionUser) { return this.cal.connectUrl(u.id); }

  /** Google redirects the browser here; the signed state says who started it */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: Response) {
    res.redirect(302, await this.cal.callback(code, state, error));
  }

  @Patch('accounts/:id') update(@Param('id', ParseIntPipe) id: number, @Body() b: { enabled?: boolean; color?: string }, @CurrentUser() u: SessionUser) { return this.cal.update(u.id, id, b ?? {}); }
  @Delete('accounts/:id') remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) { return this.cal.remove(u.id, id); }
  @Get('events') events(@Query('from') from: string, @Query('to') to: string, @CurrentUser() u: SessionUser) { return this.cal.events(u.id, from, to); }
}
