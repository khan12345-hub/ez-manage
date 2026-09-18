import { Module } from '@nestjs/common';
import { CellsService } from './cells.service';
import { CellsController } from './cells.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { StorageModule } from 'src/storage/storage.module';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { AutomationEngineService } from 'src/automations/automation-engine.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [CellsController],
  providers: [CellsService, PrismaService, BoardAccessService, ActivityLogsService, AutomationEngineService],
})
export class CellsModule {}
