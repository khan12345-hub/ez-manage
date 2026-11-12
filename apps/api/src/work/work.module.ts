import { Module } from '@nestjs/common';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';
import { WorkAccessService } from './work-access.service';
import { WorkDetailService } from './work-detail.service';
import { WorkFilesService } from './work-files.service';
import { WorkPeopleService } from './work-people.service';
import { WorkInboxService } from './work-inbox.service';
import { WorkOverviewService } from './work-overview.service';
import { WorkFieldsService } from './work-fields.service';
import { WorkRemindersService } from './work-reminders.service';
import { WorkExtrasService } from './work-extras.service';
import { WorkStatsService } from './work-stats.service';
import { WorkProfileService } from './work-profile.service';
import { WorkNotifyService } from './work-notify.service';
import { WorkAutomationsService } from './work-automations.service';
import { WorkChatService } from './work-chat.service';
import { MailModule } from 'src/mail/mail.module';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

/** Work — the ClickUp-style product (Space → Folder → List → Task). */
@Module({
  imports: [StorageModule, NotificationsModule, MailModule],
  controllers: [WorkController],
  // CEO Tower acts through Work's own services (as the CEO, with Work's permissions)
  exports: [WorkService, WorkChatService],
  providers: [WorkService, WorkAccessService, WorkDetailService, WorkFilesService, WorkPeopleService, WorkInboxService, WorkOverviewService, WorkFieldsService, WorkRemindersService, WorkExtrasService, WorkStatsService, WorkProfileService, WorkNotifyService, WorkAutomationsService, WorkChatService],
})
export class WorkModule {}
