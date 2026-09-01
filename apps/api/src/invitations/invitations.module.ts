import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { MailModule } from 'src/mail/mail.module';
import { UsersRepository } from 'src/users/users.repository';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, UsersRepository],
})
export class InvitationsModule {}
