import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards, Param } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { SessionUser } from './types/session-user.type';
import type { Response } from 'express';
import { Request } from 'express-session';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupAccountDto } from './dto/setup-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { ChatGateway } from 'src/chat/chat.gateway';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly chatGateway: ChatGateway,
  ) {}
  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req);
  }

  @SkipThrottle()
  @Get('me')
  async me(@CurrentUser() user: SessionUser) {
    return this.authService.me(user);
  }

  @Post('logout')
  async logout(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req, res);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: SessionUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @Post('setup-account')
  async setupAccount(
    @Body() dto: SetupAccountDto,
    @Req() req: any,
  ) {
    return this.authService.setupAccount(dto, req);
  }

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Get('invitation-details/:token')
  async getInvitationDetails(@Param('token') token: string) {
    return this.authService.getInvitationDetails(token);
  }

  @Patch('status')
  async setStatus(
    @CurrentUser() user: SessionUser,
    @Body() body: { emoji?: string | null; text?: string | null; clearsAt?: string | null },
  ) {
    const clearsAt = body.clearsAt ? new Date(body.clearsAt) : null;
    const result = await this.authService.setUserStatus(
      user.id,
      body.emoji ?? null,
      body.text ?? null,
      clearsAt,
    );
    // Broadcast to all connected chat users
    this.chatGateway.broadcastUserStatus(user.id, result.chatStatusEmoji, result.chatStatusText);
    return result;
  }
}

