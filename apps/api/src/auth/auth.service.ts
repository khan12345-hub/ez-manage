// auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { Request } from 'express-session';
import { LoginDto } from './dto/login.dto';
import { SessionUser } from './types/session-user.type';
import { AuthRepository } from './auth.repository';
import { UserStatus } from '@repo/shared';
import { Response } from 'express';
import { PrismaService } from 'prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupAccountDto } from './dto/setup-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { BoardMemberRole, WorkspaceMemberRole } from 'generated/prisma/enums';
import { MailService } from 'src/mail/mail.service';

function workspaceToBoardRole(role: WorkspaceMemberRole): BoardMemberRole {
  switch (role) {
    case WorkspaceMemberRole.OWNER:  return BoardMemberRole.OWNER;
    case WorkspaceMemberRole.ADMIN:  return BoardMemberRole.ADMIN;
    case WorkspaceMemberRole.MEMBER: return BoardMemberRole.MEMBER;
    default:                         return BoardMemberRole.VIEWER;
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto, req: Request) {
    const email = dto.email.trim().toLowerCase();
    // 1. Find user
    const user = await this.authRepository.findUserByEmail(email);

    // 2. User not found
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Verify password
    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 4. Check account status
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Your account is inactive. Please contact your administrator.',
      );
    }

    req.session.user = {
      id: user.id,
      systemRole: user.systemRole,
    };

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // 6. Remove password hash before returning
    const { password, ...safeUser } = user;

    return {
      message: 'Login successful.',
      user: safeUser,
    };
  }

  async me(sessionUser: SessionUser) {
    if (!sessionUser?.id) {
      throw new UnauthorizedException();
    }

    const user = await this.authRepository.findUserById(sessionUser.id);

    // User deleted
    if (!user) {
      throw new UnauthorizedException();
    }

    // User disabled after login
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Your account is inactive.');
    }
    return user;
  }

  async logout(req: Request, res: Response) {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
        }

        res.clearCookie('connect.sid');
        resolve({ message: 'Logout successful.' });
      });
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    const userWithHash = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!userWithHash) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      userWithHash.password,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async setupAccount(dto: SetupAccountDto, req: Request) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
      include: {
        workspace: true,
        boards: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or invalid.');
    }

    if (
      invitation.status !== 'PENDING' ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Invitation has expired or already accepted.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: invitation.email,
          password: hashedPassword,
          status: 'ACTIVE',
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId: newUser.id,
          role: invitation.role,
        },
      });

      const boardGroupAccess = invitation.boardGroupAccess as
        | { boardId: number; groupIds: number[] }[]
        | null;

      const createdMembers = await tx.boardMember.createManyAndReturn({
        data: invitation.boardIds.map((boardId) => {
          const entry = boardGroupAccess?.find((g) => g.boardId === boardId);
          const accessAllGroups = !entry || entry.groupIds.length === 0;
          return {
            boardId,
            userId: newUser.id,
            role: workspaceToBoardRole(invitation.role),
            accessAllGroups,
          };
        }),
      });

      for (const member of createdMembers) {
        const entry = boardGroupAccess?.find((g) => g.boardId === member.boardId);
        if (entry && entry.groupIds.length > 0) {
          await tx.boardMemberGroupAccess.createMany({
            data: entry.groupIds.map((groupId) => ({
              boardMemberId: member.id,
              groupId,
            })),
          });
        }
      }

      return newUser;
    });

    req.session.user = {
      id: user.id,
      systemRole: user.systemRole,
    };

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const { password, ...safeUser } = user;

    return {
      success: true,
      message: 'Account set up successfully.',
      user: safeUser,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success to prevent user enumeration
    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
    try {
      await this.mailService.sendMail({
        to: email,
        subject: 'Reset your password',
        text: `Click the link to reset your password (expires in 1 hour): ${resetUrl}`,
        html: `<p>Click the link below to reset your password. The link expires in <strong>1 hour</strong>.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request a password reset, please ignore this email.</p>`,
      });
    } catch {
      // Mail failure must never reveal whether the account exists
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: dto.token },
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }

  async getInvitationDetails(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt < new Date()
    ) {
      throw new NotFoundException('Invitation not found, expired, or invalid.');
    }

    return {
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace.name,
    };
  }

  async setUserStatus(
    userId: number,
    emoji: string | null,
    text: string | null,
    clearsAt: Date | null,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        chatStatusEmoji: emoji,
        chatStatusText: text,
        chatStatusClearsAt: clearsAt,
      },
      select: {
        id: true,
        chatStatusEmoji: true,
        chatStatusText: true,
        chatStatusClearsAt: true,
      },
    });
  }

  async getUserStatus(userId: number) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, chatStatusEmoji: true, chatStatusText: true, chatStatusClearsAt: true },
    });
    return u;
  }
}
