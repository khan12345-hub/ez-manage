import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationStreamService } from './notification-stream.service';
import { NotificationsProcessor } from './notifications.processor';
import { MailModule } from '../mail/mail.module';
// WhatsApp hook — remove this import to disable WhatsApp notifications
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    MailModule,
    WhatsappModule, // WhatsApp hook — remove this line to disable
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationStreamService,
    NotificationsProcessor, // BullMQ worker — processes queued email jobs
  ],

  exports: [
    NotificationsService,
    NotificationStreamService,
  ],
})
export class NotificationsModule {
  constructor() {}
}