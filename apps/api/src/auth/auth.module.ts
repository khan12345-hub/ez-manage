import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { SessionAuthGuard } from './guards/session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, SessionAuthGuard],
  exports: [SessionAuthGuard],
}) 
export class AuthModule {}
