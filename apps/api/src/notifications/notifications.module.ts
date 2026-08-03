import { Module } from '@nestjs/common';

import { BullModule } from '@nestjs/bullmq';

import { EventEmitterModule } from '@nestjs/event-emitter';

import { NotificationsController } from './notifications.controller';

import { NotificationsService } from './notifications.service';

import { NotificationsProcessor } from './notifications.processor';

import { NotificationsListener } from './notifications.listener';
import { MailModule } from 'src/mail/mail.module';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),



    MailModule,
  ],

  controllers: [NotificationsController],

  providers: [
    NotificationsService,

    NotificationsProcessor,

    NotificationsListener,

    // PrismaService,
  ],

  exports: [NotificationsService, 
    // PrismaService
  ],
})
export class NotificationsModule {}
