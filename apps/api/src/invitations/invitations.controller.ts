import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { WorkspaceMemberRole } from 'generated/prisma/enums';

@Controller('invitation')
@UseGuards(SessionAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('create')
  create(@Body() dto: CreateInvitationDto, @CurrentUser() user) {
    return this.invitationsService.create(dto, user.id);
  }

  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto, @CurrentUser() user) {
    return this.invitationsService.accept(dto, user.id);
  }

  @Get('pending')
  getPending(@Query('workspaceId', ParseIntPipe) workspaceId: number) {
    return this.invitationsService.getPendingInvitations(workspaceId);
  }

  @Delete(':id/revoke')
  revoke(@Param('id', ParseIntPipe) id: number, @CurrentUser() user) {
    return this.invitationsService.revokeInvitation(id, user.id);
  }

  @Post('generate-link')
  generateLink(
    @Body() body: { workspaceId: number; role?: WorkspaceMemberRole; expiresInDays?: number },
    @CurrentUser() user,
  ) {
    return this.invitationsService.generateLink(
      body.workspaceId,
      body.role ?? WorkspaceMemberRole.MEMBER,
      user.id,
      body.expiresInDays,
    );
  }

  @Post('accept-link')
  acceptLink(@Body() body: { token: string }, @CurrentUser() user) {
    return this.invitationsService.acceptLink(body.token, user.id);
  }
}
