import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserSettingsDto } from './dto/update-user.dto';
import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  // users.controller.ts

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    return this.usersService.findByEmailForInvite(email);
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
