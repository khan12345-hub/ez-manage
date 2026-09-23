import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { UpdateUserSettingsDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateWhatsappSettingsDto } from './dto/update-whatsapp-settings.dto';
import { VerifyWhatsappOtpDto } from './dto/verify-whatsapp-otp.dto';
import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { AdminGuard } from 'src/auth/guards/admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // List all users — SUPER_ADMIN only (system settings)
  @Get()
  @UseGuards(SessionAuthGuard, AdminGuard)
  async findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  // Create user directly — SUPER_ADMIN only
  @Post()
  @UseGuards(SessionAuthGuard, AdminGuard)
  async createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  // Admin update (role, status) — SUPER_ADMIN only
  @Patch(':id')
  @UseGuards(SessionAuthGuard, AdminGuard)
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdateUser(id, dto);
  }

  // Delete user — SUPER_ADMIN only
  @Delete(':id')
  @UseGuards(SessionAuthGuard, AdminGuard)
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(id);
  }

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    return this.usersService.findByEmailForInvite(email);
  }
  @Get('me/notification-preferences')
  async getNotificationPreferences(@CurrentUser() user: SessionUser) {
    return this.usersService.getNotificationPreferences(user.id);
  }

  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.id, dto);
  }

  @Get('me/whatsapp-settings')
  async getWhatsappSettings(@CurrentUser() user: SessionUser) {
    return this.usersService.getWhatsappSettings(user.id);
  }

  @Patch('me/whatsapp-settings')
  async updateWhatsappSettings(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateWhatsappSettingsDto,
  ) {
    return this.usersService.updateWhatsappSettings(user.id, dto);
  }

  @Post('me/whatsapp-settings/send-otp')
  async sendWhatsappOtp(@CurrentUser() user: SessionUser) {
    return this.usersService.sendWhatsappOtp(user.id);
  }

  @Post('me/whatsapp-settings/verify-otp')
  async verifyWhatsappOtp(
    @CurrentUser() user: SessionUser,
    @Body() dto: VerifyWhatsappOtpDto,
  ) {
    return this.usersService.verifyWhatsappOtp(user.id, dto);
  }

  @Get('me/whatsapp-logs')
  async getWhatsappLogs(
    @CurrentUser() user: SessionUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getWhatsappLogs(
      user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }

  @Patch('me/settings')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateSettings(
    @CurrentUser() user: SessionUser,

    @Body() dto: UpdateUserSettingsDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.usersService.updateSettings(user.id, dto, avatar);
  }
}
