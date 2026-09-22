import { Module } from '@nestjs/common';
import { FileCommentsController } from './file-comments.controller';
import { FileCommentsService } from './file-comments.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FileCommentsController],
  providers: [FileCommentsService],
})
export class FileCommentsModule {}
