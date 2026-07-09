import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { UsersRepository } from 'src/users/users.repository';

@Module({
  imports:[MailModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, UsersRepository],
})
export class InvitationsModule {}
