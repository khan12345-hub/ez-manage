import { Module } from '@nestjs/common';
import { WorkModule } from 'src/work/work.module';
import { BullModule } from '@nestjs/bullmq';

import { CeoAssistantController } from './ceo-assistant.controller';
import { TaskAnalyzerService } from './services/task-analyzer.service';
import { EmailGeneratorService } from './services/email-generator.service';
import { EmailSenderService } from './services/email-sender.service';
import { TemplateService } from './services/template.service';
import { ManagementService } from './services/management.service';
import { CeoMeetingService } from './services/ceo-meeting.service';
import { CeoSettingsService } from './services/ceo-settings.service';
import { CeoEmailProcessor, CEO_EMAIL_QUEUE } from './ceo-email.processor';

import { MailModule } from 'src/mail/mail.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: CEO_EMAIL_QUEUE }),
    MailModule,
    NotificationsModule,
    WorkModule,
  ],
  controllers: [CeoAssistantController],
  providers: [
    TaskAnalyzerService,
    EmailGeneratorService,
    EmailSenderService,
    TemplateService,
    ManagementService,
    CeoMeetingService,
    CeoSettingsService,
    CeoEmailProcessor,
  ],
  // CEO Tower schedules meetings through the same service (same reminders)
  exports: [CeoMeetingService],
})
export class CeoAssistantModule {}
