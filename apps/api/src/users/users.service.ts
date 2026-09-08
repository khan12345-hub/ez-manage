import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserSettingsDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { Prisma } from 'generated/prisma/client';
import { SystemRole } from 'generated/prisma/enums';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LocalStorageService } from 'src/storage/local-storage.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
  ) {}
  // users.service.ts

  private readonly adminSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatarUrl: true,
    systemRole: true,
    status: true,
    createdAt: true,
  };

  async createUser(dto: CreateUserDto) {
    const emailLower = dto.email.toLowerCase().trim();

    const active = await this.prisma.user.findFirst({
      where: { email: emailLower, deletedAt: null },
    });
    if (active) {
      throw new BadRequestException('A user with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const deleted = await this.prisma.user.findFirst({
      where: { email: emailLower, deletedAt: { not: null } },
    });

    if (deleted) {
      return this.prisma.user.update({
        where: { id: deleted.id },
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          password: hashedPassword,
          systemRole: (dto.systemRole ?? 'USER') as SystemRole,
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: this.adminSelect,
      });
    }

    return this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: emailLower,
        password: hashedPassword,
        systemRole: (dto.systemRole ?? 'USER') as SystemRole,
      },
      select: this.adminSelect,
    });
  }

  async adminUpdateUser(id: number, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.systemRole !== undefined) data.systemRole = dto.systemRole as SystemRole;
    if (dto.newPassword) data.password = await bcrypt.hash(dto.newPassword, 10);

    return this.prisma.user.update({
      where: { id },
      data,
      select: this.adminSelect,
    });
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'User deleted successfully' };
  }

  async findAll(search?: string) {
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: this.adminSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getNotificationPreferences(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        emailNotificationsEnabled: true,
        inAppNotificationsEnabled: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateNotificationPreferences(
    userId: number,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailNotificationsEnabled: dto.emailNotificationsEnabled,
        inAppNotificationsEnabled: dto.inAppNotificationsEnabled,
      },
      select: {
        emailNotificationsEnabled: true,
        inAppNotificationsEnabled: true,
      },
    });
  }

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
