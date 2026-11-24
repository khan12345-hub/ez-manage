import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { MailModule } from 'src/mail/mail.module';
import { CrmAccessService } from './crm-access.service';
import { CrmController } from './crm.controller';
import { CrmRecordsService } from './crm-records.service';
import { CrmSetupService } from './crm-setup.service';

/** EZ Sales (5th product): its own data, access and routes under /api/crm. */
@Module({
  imports: [NotificationsModule, MailModule],
  controllers: [CrmController],
  providers: [CrmAccessService, CrmSetupService, CrmRecordsService],
})
export class CrmModule {}
