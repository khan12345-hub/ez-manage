import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('invitation')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}
  @Post('create')
  @UseGuards(SessionAuthGuard)
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user) {
    return this.invitationsService.create(dto, user.id);
  }

  @Post('accept')
  @UseGuards(SessionAuthGuard)
  accept(@Body() dto: AcceptInvitationDto, @CurrentUser() user) {
    return this.invitationsService.accept(dto, user.id);
  }
}
