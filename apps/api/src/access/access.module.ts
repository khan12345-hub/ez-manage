import { Module } from '@nestjs/common';
import { InvitationsModule } from 'src/invitations/invitations.module';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { WorkModule } from 'src/work/work.module';
import { AccessCenterGuard, AccessController, MyAccessController } from './access.controller';
import { MailModule } from 'src/mail/mail.module';
import { AccessService } from './access.service';

/** Access Center (System Settings, Administrator only) */
@Module({
  imports: [InvitationsModule, WorkspaceModule, WorkModule, MailModule],
  controllers: [MyAccessController, AccessController],
  providers: [AccessService, AccessCenterGuard],
})
export class AccessModule {}
