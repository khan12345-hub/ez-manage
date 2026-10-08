import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { StorageModule } from 'src/storage/storage.module';
import { NotificationsModule} from 'src/notifications/notifications.module';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService, ActivityLogsService],
})
export class CommentsModule {}
