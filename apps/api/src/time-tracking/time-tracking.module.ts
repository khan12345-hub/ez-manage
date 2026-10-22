import { Module } from '@nestjs/common';
import { TimeTrackingBoardController, TimeTrackingController, TimeTrackingGlobalController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaModule } from 'prisma/prisma.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TimeTrackingController, TimeTrackingGlobalController, TimeTrackingBoardController],
  providers: [TimeTrackingService, BoardAccessService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
