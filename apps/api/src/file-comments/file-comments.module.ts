import { Module } from '@nestjs/common';
import { FileCommentsController } from './file-comments.controller';
import { FileCommentsService } from './file-comments.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FileCommentsController],
  providers: [FileCommentsService, PrismaService, BoardAccessService],
})
export class FileCommentsModule {}
