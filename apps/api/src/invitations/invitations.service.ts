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

import { InvitationsRepository } from './invitations.repository';
import { UsersRepository } from '../users/users.repository';
import { MailService } from '../mail/mail.service';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { randomUUID } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import 'dotenv';
import { invitationTemplate } from 'src/mail/templates/invitation.template';
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateInvitationDto, invitedById: number) {
    // ------------------------------------------------------------
    // 1. Check if the invited user already exists
    // ------------------------------------------------------------
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      await this.prisma.$transaction(async (tx) => {
        // Ensure the user belongs to the workspace
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

        // Find boards the user is already a member of
        const existingBoardMembers = await tx.boardMember.findMany({
          where: {
            userId: existingUser.id,
            boardId: {
              in: dto.boardIds,
            },
          },
          select: {
            boardId: true,
          },
        });

        const existingBoardIds = new Set(
          existingBoardMembers.map((boardMember) => boardMember.boardId),
        );

        const boardsToAdd = dto.boardIds.filter(
          (boardId) => !existingBoardIds.has(boardId),
        );

        if (boardsToAdd.length === 0) {
          throw new BadRequestException(
            'This user is already a member of all selected boards.',
          );
        }

        await tx.boardMember.createMany({
          data: boardsToAdd.map((boardId) => ({
            boardId,
            userId: existingUser.id,
            role: dto.role,
          })),
        });
      });

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
    // ------------------------------------------------------------
    const inviteUrl = `${process.env.FRONTEND_URL}/setup-account?token=${token}`;

    const template = invitationTemplate(inviteUrl);

    await this.mailService.sendMail({
      to: dto.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

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
    // return this.prisma.invitation.update({
    //   where: { id },
    //   data: {
    //     status: InvitationStatus.ACCEPTED,
    //   },
    // });

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }
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

      await tx.boardMember.createMany({
        data: invitation.boardIds.map((boardId) => ({
          boardId,
          userId: id,
          role: invitation.role,
        })),
      });
    });
  }
}
