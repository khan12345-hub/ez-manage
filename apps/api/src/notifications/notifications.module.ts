import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationStreamService } from './notification-stream.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],

  controllers: [
    NotificationsController,
  ],

  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationStreamService,
  ],

  exports: [
    NotificationsService,
    NotificationStreamService,
  ],
})
export class NotificationsModule {
  constructor() {}
}