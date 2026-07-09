import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InvitationStatus, WorkspaceRole } from '../../generated/prisma/client';

import { InvitationsRepository } from './invitations.repository';
import { UsersRepository } from '../users/users.repository';
import { MailService } from '../mail/mail.service';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { randomUUID } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import 'dotenv';
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateInvitationDto, invitedById: number) {
    const inviter = await this.usersRepository.findById(invitedById);

    if (!inviter) {
      throw new NotFoundException('Inviting user not found.');
    }

    // Verify inviter belongs to the workspace
    const membership = await this.usersRepository.findWorkspaceMembership(
      invitedById,
      dto.workspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace.');
    }

    // Verify inviter has permission to invite
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to invite users.',
      );
    }

    // Check if the invited user already exists
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException('A user with this email already exists.');
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: dto.email,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('A pending invitation already exists.');
    }
    const token = randomUUID();
    const link = `${process.env.FRONTEND_URL}/setup-account?token=${token}`;

    // console.log('Link for email', link);
    // Verify the authenticated user exists
    await this.mailService.sendMail({
      to: dto.email,
      subject: 'You have been invited to join EzManage',
      html: `
        <p>You have been invited to join EzManage.</p>
        <p>
          Click
          <a href="${link}">
            here
          </a>
          to accept the invitation.
        </p>
      `,
      text: `You have been invited to join EzManage. Accept your invitation here: http://localhost:3000/invitations/${token}`,
    });
    // Create invitation
    // Add checks all the selected board should be part of workspace
    // const board = await this.prisma.board.findUnique({
    //   where: {
    //     id: dto.boardId,
    //   },
    // });

    // if (!board || board.workspaceId !== dto.workspaceId) {
    //   throw new BadRequestException(
    //     'The specified board does not belong to this workspace.',
    //   );
    // }

    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        user: {
          email: dto.email,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException(
        'User is already a member of this workspace.',
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.$transaction(async (tx) => {
      // Validate that all selected boards belong to the selected workspace
      const boards = await tx.board.findMany({
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

      // Create invitation
      const invitation = await tx.invitation.create({
        data: {
          email: dto.email,
          token,
          workspaceId: dto.workspaceId,
          boardIds:dto.boardIds,
          role: dto.role,
          invitedById,
          expiresAt,
          status: InvitationStatus.PENDING,
        },
      });

      // Assign boards to the invitation
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

    console.log("invi", invitation)

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
          userId:id,
        })),
      });

  


    });
  }
}
