// auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Request } from 'express-session';
import { LoginDto } from './dto/login.dto';
import { AuthRepository } from './auth.repository';
import { UserStatus } from '@repo/shared';
import { Response } from 'express';
import { PrismaService } from 'prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetupAccountDto } from './dto/setup-account.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto, req: Request) {
    // 1. Find user
    const user = await this.authRepository.findUserByEmail(dto.email);

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

    // 5. Create session
    req.session.user = {
      id: user.id,
    };

    // Optional but recommended
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

  // auth.service.ts

  async me(req: Request) {
    // Not logged in
    if (!req.id) {
      throw new UnauthorizedException();
    }

    const user = await this.authRepository.findUserById(req.id);

    // User deleted
    if (!user) {
      throw new UnauthorizedException();
    }

    // User disabled after login
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Your account is inactive.');
    }

    const { password, ...safeUser } = user;

    return {
      user: safeUser,
    };
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
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
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

      await tx.boardMember.createMany({
        data: invitation.boardIds.map((boardId) => ({
          boardId,
          userId:newUser.id,
        })),
      });

      return newUser;
    });

    req.session.user = {
      id: user.id,
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
}
