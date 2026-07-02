import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
export declare class InvitationsController {
    private readonly invitationsService;
    constructor(invitationsService: InvitationsService);
    create(dto: CreateInvitationDto, invitedBy: any): Promise<any>;
}
