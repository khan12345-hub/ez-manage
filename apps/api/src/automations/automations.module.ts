import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { BoardsModule } from 'src/boards/boards.module';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  imports: [BoardsModule],
  controllers: [AutomationsController],
  // BoardAccessService is needed by BoardPermissionGuard.
  providers: [AutomationsService, BoardAccessService],
})
export class AutomationsModule {}
