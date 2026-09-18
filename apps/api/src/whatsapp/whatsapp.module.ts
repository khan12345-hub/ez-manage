import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { AutomationEngineService } from '../automations/automation-engine.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, PrismaService, ActivityLogsService, AutomationEngineService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
