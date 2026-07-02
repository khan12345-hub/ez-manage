import { InvitationsRepository } from './invitations.repository';
import { UsersRepository } from '../users/users.repository';
import { CreateInvitationDto } from './dto/create-invitation.dto';
export declare class InvitationsService {
    private readonly invitationsRepository;
    private readonly usersRepository;
    constructor(invitationsRepository: InvitationsRepository, usersRepository: UsersRepository);
    create(dto: CreateInvitationDto, invitedBy: number): Promise<any>;
    validateInvitation(token: string): Promise<any>;
    markAccepted(id: number): Promise<any>;
}
