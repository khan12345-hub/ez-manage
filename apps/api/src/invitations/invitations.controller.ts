import { Body, Controller, Post } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}
  @Post()
  create(@Body() dto: CreateInvitationDto, invitedBy) {
    return this.invitationsService.create(dto, invitedBy);
  }
}
