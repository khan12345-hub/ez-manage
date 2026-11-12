import { Module } from '@nestjs/common';
import { CeoTowerController } from './ceo-tower.controller';
import { CeoTowerService } from './ceo-tower.service';

/** CEO Tower — a read-only view across the Boards and Work companies a person owns. */
@Module({
  controllers: [CeoTowerController],
  providers: [CeoTowerService],
  exports: [CeoTowerService],
})
export class CeoTowerModule {}
