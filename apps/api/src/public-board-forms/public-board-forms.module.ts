import { Module } from '@nestjs/common';
import { PublicBoardFormsService } from './public-board-forms.service';
import { PublicBoardFormsController } from './public-board-forms.controller';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { StorageModule } from 'src/storage/storage.module';

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [PublicBoardFormsController],
  providers: [PublicBoardFormsService, PrismaService],
})
export class PublicBoardFormsModule {}
