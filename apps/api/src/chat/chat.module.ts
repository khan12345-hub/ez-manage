import { Module } from '@nestjs/common';
import { ChatController, GlobalChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { NotificationStreamService } from '../notifications/notification-stream.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [NotificationsModule, PushModule, StorageModule],
  controllers: [ChatController, GlobalChatController],
  providers: [ChatGateway, ChatService, NotificationStreamService, ScheduledMessagesService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
