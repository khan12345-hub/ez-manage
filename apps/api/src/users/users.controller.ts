import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  // users.controller.ts

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    return this.usersService.findByEmailForInvite(email);
  }
}
