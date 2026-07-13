import { Body, Controller, Get, Post, Req, Res, UseGuards, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { SessionUser } from './types/session-user.type';
import type { Response } from 'express';
import { Request } from 'express-session';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupAccountDto } from './dto/setup-account.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const user = this.authService.login(dto, req);
    
    return user;
  }

  @Get('me')
  async me(@CurrentUser() user: SessionUser
  ) {
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
  @Get('invitation-details/:token')
  async getInvitationDetails(@Param('token') token: string) {
    return this.authService.getInvitationDetails(token);
  }
}

