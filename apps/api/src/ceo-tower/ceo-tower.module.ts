import { Module } from '@nestjs/common';
import { CeoTowerController } from './ceo-tower.controller';
import { CeoTowerService } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';
import { WorkModule } from 'src/work/work.module';
import { MailModule } from 'src/mail/mail.module';
import { CeoAssistantModule } from 'src/ceo-assistant/ceo-assistant.module';
import { CeoCommsService } from './ceo-comms.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

/** CEO Tower — a read-only view across the Boards and Work companies a person owns. */
@Module({
  imports: [WorkModule, MailModule, CeoAssistantModule, NotificationsModule],
  controllers: [CeoTowerController],
  providers: [CeoTowerService, CeoAiService, CeoCommsService],
  exports: [CeoTowerService],
})
export class CeoTowerModule {}
