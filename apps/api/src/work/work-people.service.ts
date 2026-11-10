import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationEntityType, NotificationType } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkAccessService, type WorkRoleName } from './work-access.service';
import { WorkNotifyService } from './work-notify.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;
const INVITABLE: WorkRoleName[] = ['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST'];
const ROLE_LABEL: Record<WorkRoleName, string> = { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member', LIMITED_MEMBER: 'Limited Member', GUEST: 'Guest' };

/**
 * Work people: its own members and invites, separate from Boards.
 * Existing accounts get access at once; new emails get an invite that,
 * on sign-up, grants Work access only (never Boards).
 */
@Injectable()
export class WorkPeopleService {
  private readonly logger = new Logger(WorkPeopleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly workNotify: WorkNotifyService,
  ) {}

  /* ── Work workspaces (ClickUp-style; nothing to do with Boards workspaces) ── */

  async createWorkspace(userId: number, dto: { name: string; color?: string; useCase?: string; teamSize?: string; inviteEmails?: string[] }) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name your workspace.');
    const ws = await this.prisma.workWorkspace.create({
      data: {
        uid: randomUUID().replace(/-/g, '').slice(0, 12),
        name,
        color: dto.color ?? '#047857',
        useCase: dto.useCase ?? null,
        teamSize: dto.teamSize ?? null,
        createdById: userId,
        members: { create: [{ userId, role: 'OWNER' }] },
        // ClickUp starts every workspace with a "Team Space"
        spaces: {
          create: [{
            uid: randomUUID().replace(/-/g, '').slice(0, 12),
            name: 'Team Space',
            color: dto.color ?? '#047857',
            createdById: userId,
            members: { create: [] },
            statuses: {
              create: [
                { name: 'To do', color: '#9CA3AF', category: 'NOT_STARTED', order: 1000 },
                { name: 'In progress', color: '#2563EB', category: 'ACTIVE', order: 2000 },
                { name: 'Complete', color: '#16A34A', category: 'DONE', order: 3000 },
              ],
            },
          }],
        },
      },
      select: { id: true, uid: true, name: true, color: true },
    });
    const emails = (dto.inviteEmails ?? []).map((e) => e.trim()).filter(Boolean);
    const invited = emails.length ? (await this.invite(ws.id, userId, emails, 'MEMBER')).results : [];
    return { ...ws, invited };
  }

  async updateWorkspace(workspaceId: number, userId: number, dto: { name?: string; color?: string; avatarUrl?: string | null }) {
    await this.access.requireWorkspace(workspaceId, userId, 'manage');
    return this.prisma.workWorkspace.update({
      where: { id: workspaceId },
      data: { ...(dto.name?.trim() && { name: dto.name.trim() }), ...(dto.color && { color: dto.color }), ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }) },
      select: { id: true, uid: true, name: true, color: true, avatarUrl: true },
    });
  }

  async deleteWorkspace(workspaceId: number, userId: number, confirmName: string) {
    const me = await this.access.requireWorkspace(workspaceId, userId, 'manage');
    if (me.role !== 'OWNER') throw new ForbiddenException('Only the workspace owner can delete it.');
    const ws = await this.prisma.workWorkspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    if (!ws || ws.name.trim() !== (confirmName ?? '').trim()) throw new BadRequestException('Type the workspace name to confirm.');
    await this.prisma.workWorkspace.update({ where: { id: workspaceId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  /** Workspaces where this user can open Work. */
  async myWorkspaces(userId: number) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { systemRole: true } });
    if (!user) return [];
    const rows = await this.prisma.workMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      select: { role: true, workspace: { select: { id: true, uid: true, name: true, color: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ ...r.workspace, role: r.role }));
  }

  async people(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const members = await this.prisma.workMember.findMany({
      where: { workspaceId, user: { deletedAt: null } },
      select: { role: true, createdAt: true, user: { select: USER_MINI } },
      orderBy: { createdAt: 'asc' },
    });
    const invites = ws.canManage
      ? await this.prisma.workInvitation.findMany({
          where: { workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } },
          select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    return { me: { role: ws.role, canManage: ws.canManage }, members, invites: invites.map(({ role, ...i }) => ({ ...i, workRole: role })) };
  }

  async invite(workspaceId: number, userId: number, emails: string[], role: WorkRoleName) {
    await this.access.requireWorkspace(workspaceId, userId, 'manage');
    if (!INVITABLE.includes(role)) throw new BadRequestException('That role cannot be invited.');
    const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!list.length) throw new BadRequestException('Add at least one email.');
    const bad = list.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad.length) throw new BadRequestException(`Not a valid email: ${bad.join(', ')}`);
    const ws = await this.prisma.workWorkspace.findUnique({ where: { id: workspaceId }, select: { name: true, uid: true } });
    const inviter = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const inviterName = `${inviter?.firstName ?? ''} ${inviter?.lastName ?? ''}`.trim() || 'Someone';

    const results: { email: string; status: 'added' | 'invited' | 'already_member' | 'already_invited' }[] = [];
    for (const email of list) {
      const user = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
      if (user) {
        const existing = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
        if (existing) { results.push({ email, status: 'already_member' }); continue; }
        await this.prisma.workMember.create({ data: { workspaceId, userId: user.id, role, invitedById: userId } });
        await this.workNotify.send({
          recipientId: user.id,
          type: NotificationType.WORKSPACE_MEMBER_ADDED,
          title: 'You were added to a Work workspace',
          message: `${inviterName} added you to ${ws?.name ?? 'a workspace'} as ${ROLE_LABEL[role]}.`,
          metadata: { event: 'added', url: `/work/${ws?.uid ?? workspaceId}`, actorName: inviterName },
        });
        results.push({ email, status: 'added' });
        continue;
      }
      const pending = await this.prisma.workInvitation.findFirst({ where: { workspaceId, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } } });
      if (pending) { results.push({ email, status: 'already_invited' }); continue; }
      const token = randomUUID();
      await this.prisma.workInvitation.create({
        data: { email, token, workspaceId, role, invitedById: userId, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
      });
      const url = `${process.env.FRONTEND_URL}/setup-account?token=${token}`;
      try {
        await this.mail.sendMail({
          to: email,
          subject: `${inviterName} invited you to Work in ${ws?.name ?? 'EZ Manage'}`,
          html: `<p>${inviterName} invited you to <b>Work</b> in <b>${ws?.name ?? 'EZ Manage'}</b> as <b>${ROLE_LABEL[role]}</b>.</p><p><a href="${url}">Accept the invitation</a></p><p>This link expires in 7 days.</p>`,
          text: `${inviterName} invited you to Work in ${ws?.name ?? 'EZ Manage'} as ${ROLE_LABEL[role]}. Accept: ${url} (expires in 7 days)`,
        });
      } catch (e: any) {
        this.logger.warn(`work invite email failed: ${e?.message ?? e}`);
      }
      results.push({ email, status: 'invited' });
    }
    return { results };
  }

  async changeRole(workspaceId: number, actorId: number, targetId: number, role: WorkRoleName) {
    const me = await this.access.requireWorkspace(workspaceId, actorId, 'manage');
    if (!INVITABLE.includes(role)) throw new BadRequestException('That role cannot be assigned.');
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } } });
    if (!m) throw new NotFoundException('Not a Work member.');
    if (m.role === 'OWNER') throw new ForbiddenException("The owner's role can't be changed.");
    if (targetId === actorId && me.role !== 'OWNER') throw new ForbiddenException("You can't change your own role.");
    return this.prisma.workMember.update({ where: { workspaceId_userId: { workspaceId, userId: targetId } }, data: { role }, select: { role: true, user: { select: USER_MINI } } });
  }

  async remove(workspaceId: number, actorId: number, targetId: number) {
    await this.access.requireWorkspace(workspaceId, actorId, 'manage');
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetId } } });
    if (!m) throw new NotFoundException('Not a Work member.');
    if (m.role === 'OWNER') throw new ForbiddenException("The owner can't be removed.");
    await this.prisma.$transaction([
      this.prisma.spaceMember.deleteMany({ where: { userId: targetId, space: { workspaceId } } }),
      this.prisma.workMember.delete({ where: { workspaceId_userId: { workspaceId, userId: targetId } } }),
    ]);
    return { removed: true };
  }

  async revokeInvite(inviteId: number, actorId: number) {
    const inv = await this.prisma.workInvitation.findFirst({ where: { id: inviteId }, select: { id: true, workspaceId: true, status: true } });
    if (!inv) throw new NotFoundException('Invitation not found.');
    await this.access.requireWorkspace(inv.workspaceId, actorId, 'manage');
    await this.prisma.workInvitation.update({ where: { id: inv.id }, data: { status: 'REVOKED' } });
    return { revoked: true };
  }

  async spaceMembers(spaceId: number, userId: number) {
    await this.access.requireSpace(spaceId, userId, 'view');
    const rows = await this.prisma.spaceMember.findMany({ where: { spaceId }, select: { userId: true } });
    return { userIds: rows.map((r) => r.userId) };
  }
}
