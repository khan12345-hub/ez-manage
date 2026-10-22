import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { BoardsModule } from 'src/boards/boards.module';

@Module({
  imports: [BoardsModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
})
export class AutomationsModule {}
