import { Module } from '@nestjs/common';
import { TimeTrackingBoardController, TimeTrackingController, TimeTrackingGlobalController } from './time-tracking.controller';
import { TimeTrackingService } from './time-tracking.service';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TimeTrackingController, TimeTrackingGlobalController, TimeTrackingBoardController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
