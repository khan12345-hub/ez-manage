import { Module } from '@nestjs/common';
import { CeoTowerController } from './ceo-tower.controller';
import { CeoTowerService } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';
import { WorkModule } from 'src/work/work.module';

/** CEO Tower — a read-only view across the Boards and Work companies a person owns. */
@Module({
  imports: [WorkModule],
  controllers: [CeoTowerController],
  providers: [CeoTowerService, CeoAiService],
  exports: [CeoTowerService],
})
export class CeoTowerModule {}
