import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserSettingsDto } from './dto/update-user.dto';
import { Prisma } from 'generated/prisma/client';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LocalStorageService } from 'src/storage/local-storage.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
  ) {}
  // users.service.ts

  async findByEmailForInvite(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });

    return user;
  }
  async updateSettings(
    userId: number,
    dto: UpdateUserSettingsDto,
    profilePicture?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        password: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};

    // Update first name
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim();
    }

    // Update last name
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName.trim();
    }

    // Upload new profile picture
    if (profilePicture) {
      const uploadedFile = await this.storageService.upload(
        profilePicture,
        'profile-pictures',
      );

      data.avatarUrl = this.storageService.getUrl(uploadedFile.storageKey);
    }

    // Update password
    if (dto.newPassword) {
      // Current password is required
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change your password',
        );
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.password,
      );

      if (!isPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

      data.password = hashedPassword;
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });

    return updatedUser;
  }
}
