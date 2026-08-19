import { Module } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';

@Module({
  controllers: [AutomationsController],
  providers: [AutomationsService],
})
export class AutomationsModule {}
