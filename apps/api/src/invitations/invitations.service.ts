import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AccessAuditService } from 'src/access/access-audit.service';
import { ProductAccessService } from 'src/access/product-access.service';

import {
  InvitationStatus,
  WorkspaceMemberRole,
} from '../../generated/prisma/client';
import { BoardMemberRole } from 'generated/prisma/enums';

function workspaceToBoardRole(role: WorkspaceMemberRole): BoardMemberRole {
  switch (role) {
    case WorkspaceMemberRole.OWNER:  return BoardMemberRole.OWNER;
    case WorkspaceMemberRole.ADMIN:  return BoardMemberRole.ADMIN;
    case WorkspaceMemberRole.MEMBER: return BoardMemberRole.MEMBER;
    default:                         return BoardMemberRole.VIEWER;
  }
}

import { InvitationsRepository } from './invitations.repository';
import { UsersRepository } from '../users/users.repository';
import { MailService } from '../mail/mail.service';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { randomUUID } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import 'dotenv';
import { invitationTemplate } from 'src/mail/templates/invitation.template';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';

type BoardGroupAccessEntry = { boardId: number; groupIds: number[] };

async function applyGroupAccess(
  tx: any,
  boardMemberId: number,
  boardId: number,
  boardGroupAccess: BoardGroupAccessEntry[] | undefined,
) {
  const entry = boardGroupAccess?.find((g) => g.boardId === boardId);
  if (entry && entry.groupIds.length > 0) {
    await tx.boardMemberGroupAccess.createMany({
      data: entry.groupIds.map((groupId) => ({ boardMemberId, groupId })),
    });
  }
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationStreamService: NotificationStreamService,
    private readonly activityLogsService: ActivityLogsService,
    @Optional() private readonly audit?: AccessAuditService,
    @Optional() private readonly productAccess?: ProductAccessService,
  ) {}

  /**
   * Shared inviter check (invites AND invite links): active workspace
   * OWNER/ADMIN or super admin; only an OWNER may hand out the OWNER role.
   */
  private async assertWorkspaceInviter(
    workspaceId: number,
    userId: number,
    grantedRole: WorkspaceMemberRole,
  ) {
    const inviter = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { systemRole: true },
    });
    if (!inviter) {
      throw new NotFoundException('Inviting user not found.');
    }
    if (inviter.systemRole === 'SUPER_ADMIN') return;

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
      select: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace.');
    }
    if (
      membership.role !== WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to invite users.');
    }
    if (
      grantedRole === WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.OWNER
    ) {
      throw new ForbiddenException('Only a workspace owner can grant the Owner role.');
    }
  }

  /**
   * Inviter must be an active OWNER/ADMIN of the workspace (or a super admin),
   * only an OWNER may grant OWNER, and every board must belong to the workspace.
   *
   * This used to run only for NEW users — for an email that already had an
   * account, all checks were skipped, so any logged-in user could add anyone
   * (including themselves) to any workspace/board with any role, even OWNER.
   */
  private async assertCanInvite(dto: CreateInvitationDto, invitedById: number) {
    await this.assertWorkspaceInviter(dto.workspaceId, invitedById, dto.role);

    const boardCount = await this.prisma.board.count({
      where: { id: { in: dto.boardIds }, workspaceId: dto.workspaceId },
    });
    if (boardCount !== new Set(dto.boardIds).size) {
      throw new BadRequestException(
        'One or more selected boards do not belong to the selected workspace.',
      );
    }
  }

  /**
   * opts (Access Center only): `authorized` — the Access Center already checked the actor's
   * scope (Administrator / Access Manager); `silent` — no invitation email (the Access Center
   * sends one combined email for everything given).
   */
  async create(dto: CreateInvitationDto, invitedById: number, via: 'product' | 'access_center' = 'product', opts: { authorized?: boolean; silent?: boolean } = {}) {
    // ------------------------------------------------------------
    // 0. Authorize the inviter — for BOTH existing and new users
    // ------------------------------------------------------------
    if (opts.authorized) {
      const n = await this.prisma.board.count({ where: { id: { in: dto.boardIds }, workspaceId: dto.workspaceId } });
      if (n !== new Set(dto.boardIds).size) throw new BadRequestException('One or more selected boards do not belong to the selected workspace.');
    } else {
      await this.assertCanInvite(dto, invitedById);
    }

    // ------------------------------------------------------------
    // 1. Check if the invited user already exists
    // ------------------------------------------------------------
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      // Access Center: refused when the Administrator switched Accounts off for this person; otherwise it is switched on
      try {
        await this.productAccess?.allowInvite(existingUser.id, 'accounts', invitedById);
      } catch (e) {
        this.audit?.record({ actorId: invitedById, targetUserId: existingUser.id, product: 'accounts', workspaceId: dto.workspaceId, action: 'refused', toRole: dto.role, via });
        throw e;
      }
      const wasMember = await this.prisma.workspaceMember.findFirst({ where: { workspaceId: dto.workspaceId, userId: existingUser.id, deletedAt: null }, select: { id: true } });
      // Validate BEFORE entering the transaction so HttpExceptions propagate correctly
      const existingBoardMembers = await this.prisma.boardMember.findMany({
        where: { userId: existingUser.id, boardId: { in: dto.boardIds } },
        select: { boardId: true },
      });

      const existingBoardIds = new Set(
        existingBoardMembers.map((m) => m.boardId),
      );
      const boardsToAdd = dto.boardIds.filter((id) => !existingBoardIds.has(id));

      if (boardsToAdd.length === 0) {
        throw new BadRequestException(
          'This user is already a member of all selected boards.',
        );
      }

      await this.prisma.$transaction(async (tx) => {
        const workspaceMember = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: dto.workspaceId,
              userId: existingUser.id,
            },
          },
        });

        if (!workspaceMember) {
          await tx.workspaceMember.create({
            data: {
              workspaceId: dto.workspaceId,
              userId: existingUser.id,
              role: dto.role,
            },
          });
        }

        const createdMembers = await tx.boardMember.createManyAndReturn({
          data: boardsToAdd.map((boardId) => {
            const entry = dto.boardGroupAccess?.find((g) => g.boardId === boardId);
            const accessAllGroups = !entry || entry.groupIds.length === 0;
            return {
              boardId,
              userId: existingUser.id,
              role: workspaceToBoardRole(dto.role),
              accessAllGroups,
            };
          }),
        });

        for (const member of createdMembers) {
          await applyGroupAccess(tx, member.id, member.boardId, dto.boardGroupAccess);
        }
      });

      try {
        const notification = await this.notificationsService.notify({
          recipientId: existingUser.id,
          type: 'WORKSPACE_MEMBER_ADDED',
          title: 'You were added to a workspace',
          message: 'You have been added to a workspace and its boards.',
          entityType: 'WORKSPACE' as any,
          entityId: dto.workspaceId,
          metadata: { workspaceId: dto.workspaceId },
          sendEmail: true,
        });
        this.notificationStreamService.emit(existingUser.id, notification);
      } catch {
        // Notification failure must not break the invite response
      }

      if (!wasMember) this.audit?.record({ actorId: invitedById, targetUserId: existingUser.id, product: 'accounts', workspaceId: dto.workspaceId, action: 'added', toRole: dto.role, via });

      return {
        success: true,
        message: 'User added to board(s) successfully.',
        userId: existingUser.id,
      };
    }

    // ------------------------------------------------------------
    // 2. Validate inviter
    // ------------------------------------------------------------
    const inviter = await this.usersRepository.findById(invitedById);

    if (!inviter) {
      throw new NotFoundException('Inviting user not found.');
    }

    // ------------------------------------------------------------
    // 3. Verify inviter belongs to workspace
    // ------------------------------------------------------------
    // (an Administrator, or an Access Center action already checked above, needs no membership here)
    const trusted = opts.authorized || (inviter as any).systemRole === 'SUPER_ADMIN';
    const membership = trusted ? null : await this.usersRepository.findWorkspaceMembership(
      invitedById,
      dto.workspaceId,
    );

    if (!trusted && !membership) {
      throw new ForbiddenException('You are not a member of this workspace.');
    }

    // ------------------------------------------------------------
    // 4. Verify inviter has permission
    // ------------------------------------------------------------
    if (
      !trusted && membership &&
      membership.role !== WorkspaceMemberRole.OWNER &&
      membership.role !== WorkspaceMemberRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to invite users.',
      );
    }

    // ------------------------------------------------------------
    // 5. Validate selected boards belong to workspace
    // ------------------------------------------------------------
    const boards = await this.prisma.board.findMany({
      where: {
        id: {
          in: dto.boardIds,
        },
        workspaceId: dto.workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (boards.length !== dto.boardIds.length) {
      throw new BadRequestException(
        'One or more selected boards do not belong to the selected workspace.',
      );
    }

    // ------------------------------------------------------------
    // 6. Check existing invitation
    //
    // Only a NON-EXPIRED pending invitation should block
    // creating another invitation.
    // ------------------------------------------------------------
    const now = new Date();

    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: dto.email,
        workspaceId: dto.workspaceId,
        product: 'boards',
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      // Existing invitation has expired.
      // Mark it as expired so a new invitation can be created.
      if (existingInvitation.expiresAt <= now) {
        await this.prisma.invitation.update({
          where: {
            id: existingInvitation.id,
          },
          data: {
            status: InvitationStatus.EXPIRED,
          },
        });
      } else {
        // Invitation is still valid.
        throw new BadRequestException('A pending invitation already exists.');
      }
    }

    // ------------------------------------------------------------
    // 7. Generate invitation token and expiry
    // ------------------------------------------------------------
    const token = randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // ------------------------------------------------------------
    // 8. Create invitation + invitation boards
    // ------------------------------------------------------------
    const invite = await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.create({
        data: {
          email: dto.email,
          token,
          workspaceId: dto.workspaceId,
          boardIds: dto.boardIds,
          role: dto.role,
          invitedById,
          expiresAt,
          status: InvitationStatus.PENDING,
          ...(dto.boardGroupAccess?.length
            ? { boardGroupAccess: dto.boardGroupAccess as any }
            : {}),
        },
      });

      if (dto.boardIds.length > 0) {
        await tx.invitationBoard.createMany({
          data: dto.boardIds.map((boardId) => ({
            invitationId: invitation.id,
            boardId,
          })),
        });
      }

      return invitation;
    });

    // ------------------------------------------------------------
    // 9. Send invitation email AFTER successful DB creation
    // Email failure must not roll back the invitation.
    // ------------------------------------------------------------
    const inviteUrl = `${process.env.FRONTEND_URL}/setup-account?token=${token}`;

    const template = invitationTemplate(inviteUrl);

    if (!opts.silent) try {
      await this.mailService.sendMail({
        to: dto.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    } catch (mailError) {
      // Log but don't throw — invitation is already saved
      console.error('[InvitationsService] Failed to send invitation email:', mailError?.message ?? mailError);
    }

    this.audit?.record({ actorId: invitedById, targetEmail: dto.email, product: 'accounts', workspaceId: dto.workspaceId, action: 'invited', toRole: dto.role, via });

    // ------------------------------------------------------------
    // 10. Return response
    // ------------------------------------------------------------
    return {
      success: true,
      invitationId: invite.id,
      token: invite.token,
    };
  }

  async accept(dto: AcceptInvitationDto, id) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation || invitation.product !== 'boards') {
      // Work invites are accepted through account setup / Work, never as a Boards invite
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('Invitation has already been accepted.');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired.');
    }

    // Revoked invitations used to stay acceptable (only acceptedAt/expiry were checked).
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('This invitation is no longer valid.');
    }

    // An email invitation belongs to that email: a forwarded/leaked token must not
    // let a different account join the workspace with the invited role.
    const accepter = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { email: true },
    });
    if (!accepter || accepter.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new ForbiddenException('This invitation was sent to a different email address.');
    }

    const accepted = await this.prisma.$transaction(async (tx) => {
      // Mark invitation as used so it cannot be accepted a second time
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: id,
          },
        },
        update: {},
        create: {
          workspaceId: invitation.workspaceId,
          userId: id,
          role: invitation.role,
        },
      });

      const boardGroupAccess = invitation.boardGroupAccess as BoardGroupAccessEntry[] | null;

      const createdMembers = await tx.boardMember.createManyAndReturn({
        data: invitation.boardIds.map((boardId) => {
          const entry = boardGroupAccess?.find((g) => g.boardId === boardId);
          const accessAllGroups = !entry || entry.groupIds.length === 0;
          return {
            boardId,
            userId: id,
            role: workspaceToBoardRole(invitation.role),
            accessAllGroups,
          };
        }),
      });

      for (const member of createdMembers) {
        await applyGroupAccess(tx, member.id, member.boardId, boardGroupAccess ?? undefined);

        await this.activityLogsService.log({
          boardId: member.boardId,
          userId: id,
          entityType: ActivityEntityType.MEMBER,
          entityId: member.id,
          action: ActivityAction.MEMBER_ADDED,
          metadata: { role: member.role, invitedById: invitation.invitedById },
        }, tx);
      }
    });
    this.audit?.record({ actorId: invitation.invitedById, targetUserId: id, product: 'accounts', workspaceId: invitation.workspaceId, action: 'joined', toRole: invitation.role, via: 'invite_accept' });
    return accepted;
  }

  async generateLink(
    workspaceId: number,
    role: WorkspaceMemberRole,
    createdById: number,
    expiresInDays?: number,
  ) {
    // Anyone could previously mint a link (even with role OWNER) for any workspace.
    await this.assertWorkspaceInviter(workspaceId, createdById, role);

    const token = randomUUID();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await this.prisma.workspaceInviteLink.create({
      data: { token, workspaceId, role, createdById, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return { token, url: `${frontendUrl}/join?token=${token}` };
  }

  async acceptLink(token: string, userId: number) {
    const link = await this.prisma.workspaceInviteLink.findUnique({
      where: { token },
      include: { workspace: { select: { id: true, name: true } } },
    });

    if (!link) throw new NotFoundException('Invite link not found or already revoked.');
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException('This invite link has expired.');
    }

    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: link.workspaceId, userId } },
      update: {},
      create: { workspaceId: link.workspaceId, userId, role: link.role },
    });
    this.audit?.record({ actorId: link.createdById, targetUserId: userId, product: 'accounts', workspaceId: link.workspaceId, workspaceName: link.workspace.name, action: 'joined', toRole: link.role, via: 'invite_link' });

    return { joined: true, workspace: link.workspace };
  }

  async getPendingInvitations(workspaceId: number, requesterId: number) {
    // Pending invites expose email addresses: only workspace OWNER/ADMIN (or super admin).
    await this.assertWorkspaceInviter(workspaceId, requesterId, WorkspaceMemberRole.MEMBER);
    return this.prisma.invitation.findMany({
      where: {
        workspaceId,
        product: 'boards',
        status: InvitationStatus.PENDING,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(invitationId: number, requesterId: number) {
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.product !== 'boards') throw new NotFoundException('Invitation not found');
    // Previously unchecked: any signed-in user could revoke any invitation by id.
    await this.assertWorkspaceInviter(inv.workspaceId, requesterId, WorkspaceMemberRole.MEMBER);
    if (inv.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });
    return { revoked: true };
  }
}
