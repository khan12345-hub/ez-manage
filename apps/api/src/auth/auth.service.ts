// auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AccessAuditService } from 'src/access/access-audit.service';
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
import { MfaService } from './mfa/mfa.service';

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
    private readonly mfa: MfaService,
    @Optional() private readonly audit?: AccessAuditService,
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

    // 5. Second factor: if this account has MFA set up, don't sign in yet — hold a
    //    pending challenge in the session and let /auth/mfa/verify finish the sign-in.
    const methods = await this.mfa.methodsFor(user.id);
    if (methods.length) {
      req.session.mfaPending = { userId: user.id, methods, at: Date.now() };
      delete req.session.user;
      await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
      return { message: 'One more step.', mfaRequired: true, methods, email: user.email };
    }

    req.session.user = {
      id: user.id,
      systemRole: user.systemRole,
    };
    delete req.session.mfaPending;

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
      // the client sends them to set up MFA when it is mandatory but not yet configured
      mfaSetupRequired: await this.mfa.isRequired(user.id),
    };
  }

  /** finish a sign-in that was held for a second factor */
  async mfaVerify(code: string, req: Request) {
    const pending = req.session.mfaPending;
    if (!pending || Date.now() - pending.at > 10 * 60 * 1000) {
      delete req.session.mfaPending;
      throw new UnauthorizedException('Your sign-in expired. Enter your email and password again.');
    }
    const ok = await this.mfa.verifyChallenge(pending, code);
    if (!ok) throw new UnauthorizedException('That code is wrong or expired.');
    const user = await this.authRepository.findUserById(pending.userId);
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account not available.');
    req.session.user = { id: user.id, systemRole: user.systemRole };
    delete req.session.mfaPending;
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    return { message: 'Login successful.', user };
  }

  /** send an email code for the pending sign-in */
  async mfaSendEmailCode(req: Request) {
    const pending = req.session.mfaPending;
    if (!pending) throw new UnauthorizedException('No sign-in is waiting for a code.');
    if (!pending.methods.includes('email')) throw new BadRequestException('Email codes are not set up for this account.');
    const made = await this.mfa.makeEmailCode(pending.userId);
    if (made) { pending.emailCodeHash = made.hash; pending.emailExpires = made.expires; req.session.mfaPending = pending; await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve()))); }
    return { sent: true };
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
    // two-step verification state, so the app can prompt mandatory users to finish enrolling
    const mfa = await this.mfa.status(user.id).catch(() => null);
    return { ...user, mfa };
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
      // Work (ClickUp-style) invites live in their own table
      const workInvite = await this.prisma.workInvitation.findUnique({ where: { token: dto.token } });
      if (workInvite) return this.setupWorkAccount(workInvite, dto, req);
      // EZ Sales invites, too
      const crmInvite = await this.prisma.crmInvitation.findUnique({ where: { token: dto.token } });
      if (crmInvite) return this.setupCrmAccount(crmInvite, dto, req);
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

    // Already an EZ Manage user (invited from another product with the same email):
    // grant Accounts access to the existing account and send them to log in — no new password.
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
    if (existingUser) {
      const boardGroupAccess = invitation.boardGroupAccess as { boardId: number; groupIds: number[] }[] | null;
      await this.prisma.$transaction(async (tx) => {
        await tx.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
        await tx.workspaceMember.upsert({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: existingUser.id } },
          create: { workspaceId: invitation.workspaceId, userId: existingUser.id, role: invitation.role },
          update: {},
        });
        for (const boardId of invitation.boardIds) {
          const entry = boardGroupAccess?.find((g) => g.boardId === boardId);
          const accessAllGroups = !entry || entry.groupIds.length === 0;
          const m = await tx.boardMember.upsert({
            where: { boardId_userId: { boardId, userId: existingUser.id } },
            create: { boardId, userId: existingUser.id, role: workspaceToBoardRole(invitation.role), accessAllGroups },
            update: {},
          });
          if (entry && entry.groupIds.length > 0) {
            await tx.boardMemberGroupAccess.createMany({ data: entry.groupIds.map((groupId) => ({ boardMemberId: m.id, groupId })), skipDuplicates: true });
          }
        }
      });
      this.audit?.record({ actorId: invitation.invitedById, targetUserId: existingUser.id, product: 'accounts', workspaceId: invitation.workspaceId, action: 'joined', toRole: String(invitation.role), via: 'sign_up' });
      return { alreadyExists: true, email: invitation.email, message: 'You already have an account. Log in with your existing password — Accounts & Invoices access has been added.' };
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

      {
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
      }

      return newUser;
    });
    this.audit?.record({ actorId: invitation.invitedById, targetUserId: user.id, product: 'accounts', workspaceId: invitation.workspaceId, action: 'joined', toRole: invitation.role, via: 'sign_up' });
    // one sign-up covers every product they were invited to (the Access Center sends one combined email):
    // pending Company Work invitations for the same email are applied too
    const workInvites = await this.prisma.workInvitation.findMany({ where: { email: { equals: invitation.email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } } });
    for (const wi of workInvites) {
      await this.prisma.workMember.upsert({ where: { workspaceId_userId: { workspaceId: wi.workspaceId, userId: user.id } }, update: {}, create: { workspaceId: wi.workspaceId, userId: user.id, role: wi.role ?? 'MEMBER', invitedById: wi.invitedById } });
      await this.prisma.workInvitation.update({ where: { id: wi.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      this.audit?.record({ actorId: wi.invitedById, targetUserId: user.id, product: 'work', workspaceId: wi.workspaceId, action: 'joined', toRole: wi.role ?? 'MEMBER', via: 'sign_up' });
    }
    await this.applyPendingCrmInvites(user.id, invitation.email);
    await this.issueAccountKit({ id: user.id, email: user.email, firstName: user.firstName });

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

  /** Sign-up from a Work invite: the new account gets Work access only (never Boards). */
  private async setupWorkAccount(
    invite: { id: number; email: string; workspaceId: number; role: any; invitedById: number | null; status: string; acceptedAt: Date | null; expiresAt: Date },
    dto: SetupAccountDto,
    req: Request,
  ) {
    if (invite.status !== 'PENDING' || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired or already accepted.');
    }
    // Already an EZ Manage user (e.g. invited from another product with the same email):
    // don't make a new password — just grant Work access and send them to log in.
    const existingWork = await this.prisma.user.findFirst({ where: { email: { equals: invite.email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
    if (existingWork) {
      await this.prisma.$transaction(async (tx) => {
        await tx.workInvitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
        await tx.workMember.upsert({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: existingWork.id } },
          create: { workspaceId: invite.workspaceId, userId: existingWork.id, role: invite.role ?? 'MEMBER', invitedById: invite.invitedById },
          update: {},
        });
      });
      this.audit?.record({ actorId: invite.invitedById, targetUserId: existingWork.id, product: 'work', workspaceId: invite.workspaceId, action: 'joined', toRole: invite.role ?? 'MEMBER', via: 'sign_up' });
      return { alreadyExists: true, email: invite.email, message: 'You already have an account. Log in with your existing password — Company Work access has been added.' };
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { firstName: dto.firstName, lastName: dto.lastName, email: invite.email, password: hashedPassword, status: 'ACTIVE' },
      });
      await tx.workInvitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.workMember.create({ data: { workspaceId: invite.workspaceId, userId: newUser.id, role: invite.role ?? 'MEMBER', invitedById: invite.invitedById } });
      return newUser;
    });
    this.audit?.record({ actorId: invite.invitedById, targetUserId: user.id, product: 'work', workspaceId: invite.workspaceId, action: 'joined', toRole: invite.role ?? 'MEMBER', via: 'sign_up' });
    await this.applyPendingCrmInvites(user.id, invite.email);
    await this.issueAccountKit({ id: user.id, email: user.email, firstName: user.firstName });
    req.session.user = { id: user.id, systemRole: user.systemRole };
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    const { password, ...safeUser } = user;
    return { success: true, message: 'Account set up successfully.', user: safeUser };
  }

  /** when someone joins a CRM with its own invite link (no Boards/Work account yet) */
  private async setupCrmAccount(
    invite: { id: number; email: string; workspaceId: number; role: string; invitedById: number | null; status: string; acceptedAt: Date | null; expiresAt: Date },
    dto: SetupAccountDto,
    req: Request,
  ) {
    if (invite.status !== 'PENDING' || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired or already accepted.');
    }
    const existing = await this.prisma.user.findFirst({ where: { email: { equals: invite.email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.crmInvitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
        await tx.crmMember.upsert({ where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: existing.id } }, create: { workspaceId: invite.workspaceId, userId: existing.id, role: invite.role }, update: {} });
      });
      this.audit?.record({ actorId: invite.invitedById, targetUserId: existing.id, product: 'crm', workspaceId: invite.workspaceId, action: 'joined', toRole: invite.role, via: 'sign_up' });
      return { alreadyExists: true, email: invite.email, message: 'You already have an account. Log in with your existing password — EZ Sales access has been added.' };
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({ data: { firstName: dto.firstName, lastName: dto.lastName, email: invite.email, password: hashedPassword, status: 'ACTIVE' } });
      await tx.crmInvitation.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.crmMember.create({ data: { workspaceId: invite.workspaceId, userId: newUser.id, role: invite.role } });
      return newUser;
    });
    this.audit?.record({ actorId: invite.invitedById, targetUserId: user.id, product: 'crm', workspaceId: invite.workspaceId, action: 'joined', toRole: invite.role, via: 'sign_up' });
    await this.applyPendingCrmInvites(user.id, invite.email);
    await this.issueAccountKit({ id: user.id, email: user.email, firstName: user.firstName });
    req.session.user = { id: user.id, systemRole: user.systemRole };
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    const { password, ...safeUser } = user;
    return { success: true, message: 'Account set up successfully.', user: safeUser };
  }

  /** apply any other pending CRM invites for this email (one sign-up joins every CRM they were invited to) */
  private async applyPendingCrmInvites(userId: number, email: string) {
    try {
      const invites = await this.prisma.crmInvitation.findMany({ where: { email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } } });
      for (const ci of invites) {
        await this.prisma.crmMember.upsert({ where: { workspaceId_userId: { workspaceId: ci.workspaceId, userId } }, update: {}, create: { workspaceId: ci.workspaceId, userId, role: ci.role } });
        await this.prisma.crmInvitation.update({ where: { id: ci.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
        this.audit?.record({ actorId: ci.invitedById, targetUserId: userId, product: 'crm', workspaceId: ci.workspaceId, action: 'joined', toRole: ci.role, via: 'sign_up' });
      }
    } catch { /* crm tables may be absent in some deployments */ }
  }

  // ───────── Account Kit (recovery key emailed at sign-up) ─────────
  private genRecoveryKey(): string {
    const B32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read and type
    const bytes = crypto.randomBytes(20);
    let out = '';
    for (let i = 0; i < 20; i++) out += B32[bytes[i] % B32.length];
    return `EZ1-${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`;
  }
  private hashRecoveryKey(key: string): string {
    return crypto.createHash('sha256').update(String(key).replace(/[^A-Za-z0-9]/g, '').toUpperCase()).digest('hex');
  }

  /** generate the account's recovery key, store its hash, and email the "Account Kit" */
  private async issueAccountKit(user: { id: number; email: string; firstName: string }) {
    const key = this.genRecoveryKey();
    await this.prisma.user.update({ where: { id: user.id }, data: { recoveryKeyHash: this.hashRecoveryKey(key) } });
    const esc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const recoverUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/recover`;
    try {
      await this.mailService.sendMail({
        to: user.email,
        subject: 'Your EZ Manage Account Kit — keep this safe',
        html: `<p>Hi ${esc(user.firstName || '')},</p>
<p>Welcome to EZ Manage. This is your <b>Account Kit</b> — keep it somewhere safe (print it or save it offline). You'll need it if you ever forget your password.</p>
<table style="border-collapse:collapse;margin:16px 0"><tr><td style="padding:6px 10px;color:#555">Sign-in email</td><td style="padding:6px 10px;font-weight:600">${esc(user.email)}</td></tr>
<tr><td style="padding:6px 10px;color:#555">Account Recovery Key</td><td style="padding:6px 10px;font-weight:700;font-family:monospace;font-size:15px;letter-spacing:1px">${esc(key)}</td></tr></table>
<p>If you forget your password, go to <a href="${recoverUrl}">${recoverUrl}</a> and enter your email and this key to set a new one.</p>
<p style="color:#888;font-size:13px">Anyone with this key and your email can reset your password — do not share it. EZ Manage will never ask you for it.</p>`,
        text: `Hi ${user.firstName || ''},\n\nWelcome to EZ Manage. Keep this Account Kit safe — you'll need it if you forget your password.\n\nSign-in email: ${user.email}\nAccount Recovery Key: ${key}\n\nForgot your password? Go to ${recoverUrl} and enter your email and this key.\n\nAnyone with this key and your email can reset your password — do not share it.`,
      });
    } catch (e: any) { /* email failure must not block sign-up */ }
    return key;
  }

  /** reset the password using the Account Recovery Key (no email round-trip) */
  async recoverWithKey(dto: { email: string; recoveryKey: string; password: string }) {
    const email = String(dto?.email || '').trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true, recoveryKeyHash: true, status: true } });
    const ok = !!(user?.recoveryKeyHash && user.recoveryKeyHash === this.hashRecoveryKey(String(dto?.recoveryKey || '')));
    if (!ok) throw new BadRequestException("That email and Account Recovery Key don't match.");
    if (user!.status !== UserStatus.ACTIVE) throw new ForbiddenException('Your account is inactive.');
    if (!dto?.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
    const hashed = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({ where: { id: user!.id }, data: { password: hashed } });
    // sign them out of any existing sessions for safety
    await this.prisma.$executeRaw`DELETE FROM sessions WHERE (sess::jsonb -> 'user' ->> 'id') = ${String(user!.id)}`;
    return { success: true, message: 'Password reset. Sign in with your new password.' };
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

    if (!invitation) {
      const wi = await this.prisma.workInvitation.findUnique({ where: { token }, include: { workspace: true } });
      if (wi && wi.status === 'PENDING' && wi.expiresAt >= new Date() && !wi.workspace.deletedAt) {
        return { email: wi.email, role: wi.role, workspaceName: wi.workspace.name, product: 'work' };
      }
      const ci = await this.prisma.crmInvitation.findUnique({ where: { token }, include: { workspace: true } });
      if (ci && ci.status === 'PENDING' && ci.expiresAt >= new Date()) {
        return { email: ci.email, role: ci.role, workspaceName: ci.workspace.name, product: 'crm' };
      }
      throw new NotFoundException('Invitation not found, expired, or invalid.');
    }
    if (
      invitation.status !== 'PENDING' ||
      invitation.expiresAt < new Date()
    ) {
      throw new NotFoundException('Invitation not found, expired, or invalid.');
    }

    return {
      email: invitation.email,
      role: invitation.product === 'work' ? invitation.workRole ?? 'MEMBER' : invitation.role,
      workspaceName: invitation.workspace.name,
      product: invitation.product,
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
