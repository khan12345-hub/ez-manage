import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { CrmAccessService } from './crm-access.service';
import { CrmController } from './crm.controller';
import { CrmRecordsService } from './crm-records.service';
import { CrmSetupService } from './crm-setup.service';

/** EZ CRM (5th product): its own data, access and routes under /api/crm. */
@Module({
  imports: [NotificationsModule],
  controllers: [CrmController],
  providers: [CrmAccessService, CrmSetupService, CrmRecordsService],
})
export class CrmModule {}
