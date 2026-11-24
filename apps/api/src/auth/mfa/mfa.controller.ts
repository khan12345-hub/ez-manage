import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { SessionUser } from '../types/session-user.type';
import { MfaService } from './mfa.service';

/** Managing your own MFA (you are already signed in). The login challenge lives on /auth/mfa/verify. */
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get('status')
  status(@CurrentUser() u: SessionUser) {
    return this.mfa.status(u.id);
  }

  // ── authenticator app ──
  @Post('totp/begin')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  beginTotp(@CurrentUser() u: SessionUser) {
    return this.mfa.beginTotp(u.id);
  }

  @Post('totp/confirm')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmTotp(@CurrentUser() u: SessionUser, @Body() b: { code: string }) {
    return this.mfa.confirmTotp(u.id, String(b?.code ?? ''));
  }

  // ── email code method ──
  @Post('email/enable')
  enableEmail(@CurrentUser() u: SessionUser) {
    return this.mfa.enableEmail(u.id);
  }

  // ── disable one factor or all ──
  @Post('disable')
  async disable(@CurrentUser() u: SessionUser, @Body() b: { which?: 'totp' | 'email' | 'all' }) {
    const which = b?.which ?? 'all';
    if (!['totp', 'email', 'all'].includes(which)) throw new BadRequestException('Unknown method.');
    // a user for whom MFA is mandatory may not remove their last factor
    if (await this.mfa.isRequired(u.id)) {
      const methods = await this.mfa.methodsFor(u.id);
      const removing = which === 'all' ? methods : methods.filter((m) => m === which);
      if (removing.length === methods.length && methods.length > 0) {
        throw new BadRequestException('Two-step verification is required for your account. Add another method before removing this one.');
      }
    }
    return this.mfa.disable(u.id, which);
  }

  // ── recovery codes ──
  @Post('recovery/regenerate')
  regenerate(@CurrentUser() u: SessionUser) {
    return this.mfa.resetRecoveryCodes(u.id).then((recoveryCodes) => ({ recoveryCodes }));
  }
}
