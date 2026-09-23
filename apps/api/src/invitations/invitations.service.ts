import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

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
  ) {}

  async create(dto: CreateInvitationDto, invitedById: number) {
    // ------------------------------------------------------------
    // 1. Check if the invited user already exists
    // ------------------------------------------------------------
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
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
    const membership = await this.usersRepository.findWorkspaceMembership(
      invitedById,
      dto.workspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace.');
    }

    // ------------------------------------------------------------
    // 4. Verify inviter has permission
    // ------------------------------------------------------------
    if (
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

    try {
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

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('Invitation has already been accepted.');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired.');
    }

    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invitation.findUnique({
        where: { id },
      });

      if (!inv) {
        throw new NotFoundException('Invitation not found');
      }

      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: inv.workspaceId,
            userId: id,
          },
        },
        update: {},
        create: {
          workspaceId: inv.workspaceId,
          userId: id,
          role: inv.role,
        },
      });

      const boardGroupAccess = inv.boardGroupAccess as BoardGroupAccessEntry[] | null;

      const createdMembers = await tx.boardMember.createManyAndReturn({
        data: inv.boardIds.map((boardId) => {
          const entry = boardGroupAccess?.find((g) => g.boardId === boardId);
          const accessAllGroups = !entry || entry.groupIds.length === 0;
          return {
            boardId,
            userId: id,
            role: workspaceToBoardRole(inv.role),
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
          metadata: { role: member.role, invitedById: inv.invitedById },
        }, tx);
      }
    });
  }
}
