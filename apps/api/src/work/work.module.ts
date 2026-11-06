import { Module } from '@nestjs/common';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';
import { WorkAccessService } from './work-access.service';

/** Work — the ClickUp-style product (Space → Folder → List → Task). */
@Module({
  controllers: [WorkController],
  providers: [WorkService, WorkAccessService],
})
export class WorkModule {}
