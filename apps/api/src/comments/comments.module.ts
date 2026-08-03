import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { LocalStorageService } from 'src/storage/local-storage.service';
import { NotificationsModule} from 'src/notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, LocalStorageService],
})
export class CommentsModule {}
