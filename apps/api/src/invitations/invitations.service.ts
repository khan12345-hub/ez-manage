import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { InvitationsRepository } from './invitations.repository';
import { UsersRepository } from '../users/users.repository';

import { CreateInvitationDto } from './dto/create-invitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async create(dto: CreateInvitationDto, invitedBy: number) {
    // 1. User already exists?
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new BadRequestException(
        'A user with this email already exists.',
      );
    }

    // 2. Pending invitation?
    const existingInvitation =
      await this.invitationsRepository.findPendingByEmail(dto.email);

    if (existingInvitation) {
      throw new BadRequestException(
        'A pending invitation already exists.',
      );
    }

    // 3. Generate secure token
    const token = randomUUID();

    // 4. Expire after 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Save invitation
    const invitation = await this.invitationsRepository.create({
      email: dto.email,
      token,
      invitedBy,
      expiresAt,
    });

    return invitation;
  }

  async validateInvitation(token: string) {
    const invitation =
      await this.invitationsRepository.findByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.accepted_at) {
      throw new BadRequestException(
        'Invitation has already been accepted.',
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new BadRequestException(
        'Invitation has expired.',
      );
    }

    return invitation;
  }

  async markAccepted(id: number) {
    return this.invitationsRepository.markAccepted(id);
  }
}