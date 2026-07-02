import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionAuthGuard } from './guards/session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { SessionUser } from './types/session-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@CurrentUser() user: SessionUser
  ) {
    return this.authService.me(user);
  }
}
