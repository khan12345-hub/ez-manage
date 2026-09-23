import { Injectable, Optional, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserSettingsDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateWhatsappSettingsDto } from './dto/update-whatsapp-settings.dto';
import { VerifyWhatsappOtpDto } from './dto/verify-whatsapp-otp.dto';
import { Prisma } from 'generated/prisma/client';
import { SystemRole } from 'generated/prisma/enums';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
    @Optional() private readonly whatsapp: WhatsappService,
  ) {}

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
    if (active) throw new BadRequestException('A user with this email already exists');

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
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.email !== undefined) data.email = dto.email.toLowerCase().trim();
    if (dto.systemRole !== undefined) data.systemRole = dto.systemRole as SystemRole;
    if (dto.newPassword) data.password = await bcrypt.hash(dto.newPassword, 10);

    return this.prisma.user.update({ where: { id }, data, select: this.adminSelect });
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
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
    return this.prisma.user.findMany({ where, select: this.adminSelect, orderBy: { createdAt: 'asc' } });
  }

  async getNotificationPreferences(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { emailNotificationsEnabled: true, inAppNotificationsEnabled: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateNotificationPreferences(userId: number, dto: UpdateNotificationPreferencesDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailNotificationsEnabled: dto.emailNotificationsEnabled,
        inAppNotificationsEnabled: dto.inAppNotificationsEnabled,
      },
      select: { emailNotificationsEnabled: true, inAppNotificationsEnabled: true },
    });
  }

  async findByEmailForInvite(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
  }

  async updateSettings(userId: number, dto: UpdateUserSettingsDto, profilePicture?: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();

    if (profilePicture) {
      const uploadedFile = await this.storageService.upload(profilePicture, 'profile-pictures');
      data.avatarUrl = this.storageService.getUrl(uploadedFile.storageKey);
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required to change your password');
      }
      const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isPasswordValid) throw new BadRequestException('Current password is incorrect');
      data.password = await bcrypt.hash(dto.newPassword, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
  }

  private readonly whatsappSettingsSelect = {
    whatsappPhone: true,
    whatsappEnabled: true,
    whatsappPhoneVerified: true,
    whatsappOnAssigned: true,
    whatsappOnStatus: true,
    whatsappOnDate: true,
    whatsappOnComment: true,
    whatsappOnMention: true,
    whatsappOnAutomation: true,
  } as const;

  async getWhatsappSettings(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: this.whatsappSettingsSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateWhatsappSettings(userId: number, dto: UpdateWhatsappSettingsDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, whatsappPhone: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const newPhone = dto.whatsappPhone?.replace(/\s/g, '') || null;
    const phoneChanged = newPhone !== user.whatsappPhone;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.whatsappPhone !== undefined && { whatsappPhone: newPhone }),
        ...(phoneChanged && {
          whatsappPhoneVerified: false,
          whatsappEnabled: false,
          whatsappOtp: null,
          whatsappOtpExpiry: null,
        }),
        ...(dto.whatsappEnabled !== undefined && !phoneChanged && { whatsappEnabled: dto.whatsappEnabled }),
        ...(dto.whatsappOnAssigned  !== undefined && { whatsappOnAssigned:  dto.whatsappOnAssigned }),
        ...(dto.whatsappOnStatus    !== undefined && { whatsappOnStatus:    dto.whatsappOnStatus }),
        ...(dto.whatsappOnDate      !== undefined && { whatsappOnDate:      dto.whatsappOnDate }),
        ...(dto.whatsappOnComment   !== undefined && { whatsappOnComment:   dto.whatsappOnComment }),
        ...(dto.whatsappOnMention   !== undefined && { whatsappOnMention:   dto.whatsappOnMention }),
        ...(dto.whatsappOnAutomation !== undefined && { whatsappOnAutomation: dto.whatsappOnAutomation }),
      },
      select: this.whatsappSettingsSelect,
    });
  }

  async getWhatsappLogs(userId: number, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.whatsappLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsappLog.count({ where: { userId } }),
    ]);
    return { data: logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async sendWhatsappOtp(userId: number) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, whatsappPhone: true, whatsappOtpExpiry: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.whatsappPhone) throw new BadRequestException('Please save a phone number first.');

    // Rate limit: 1 OTP per minute
    if (user.whatsappOtpExpiry) {
      const secondsLeft = (user.whatsappOtpExpiry.getTime() - Date.now()) / 1000;
      if (secondsLeft > 540) { // more than 9 min left = sent within last 1 min
        throw new BadRequestException('Please wait before requesting another OTP.');
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: { whatsappOtp: otp, whatsappOtpExpiry: expiry },
    });

    if (this.whatsapp) {
      try {
        await this.whatsapp.send(
          user.whatsappPhone,
          `Your Ez-Manage verification code is: *${otp}*\n\nThis code expires in 10 minutes.`,
        );
      } catch (err: any) {
        // Clear the OTP so it can be retried
        await this.prisma.user.update({
          where: { id: userId },
          data: { whatsappOtp: null, whatsappOtpExpiry: null },
        });
        const detail = err?.response?.data?.error?.message ?? err?.message ?? 'Unknown error';
        throw new BadRequestException(`Failed to send WhatsApp OTP: ${detail}`);
      }
    } else {
      throw new BadRequestException('WhatsApp service is not configured. Please contact support.');
    }

    return { message: 'OTP sent to your WhatsApp number.' };
  }

  async verifyWhatsappOtp(userId: number, dto: VerifyWhatsappOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, whatsappOtp: true, whatsappOtpExpiry: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (!user.whatsappOtp || !user.whatsappOtpExpiry) {
      throw new BadRequestException('No OTP found. Please request a new one.');
    }
    if (new Date() > user.whatsappOtpExpiry) {
      throw new BadRequestException('OTP expired. Please request a new one.');
    }
    if (user.whatsappOtp !== dto.otp) {
      throw new BadRequestException('Incorrect OTP. Please try again.');
    }

    const verified = await this.prisma.user.update({
      where: { id: userId },
      data: {
        whatsappPhoneVerified: true,
        whatsappEnabled: true,
        whatsappOtp: null,
        whatsappOtpExpiry: null,
      },
      select: { whatsappPhone: true },
    });

    if (this.whatsapp && verified.whatsappPhone) {
      this.whatsapp.send(
        verified.whatsappPhone,
        [
          '✅ *Ez-Manage se connected ho gaye!*',
          '',
          'In commands se shuru karo:',
          '📋 *BOARDS* — apne boards dekho',
          '📅 *TODAY* — aaj ki tasks',
          '👤 *MY* — meri tasks',
          '➕ *NEW {naam}* — nai task banao',
          '❓ *HELP* — sab commands',
          '',
          'Reply karo shuru karne ke liye.',
        ].join('\n'),
      ).catch(() => {});
    }

    return { verified: true, message: 'WhatsApp number verified and notifications enabled.' };
  }
}
