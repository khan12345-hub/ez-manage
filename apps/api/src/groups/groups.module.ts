import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, PrismaService, BoardAccessService, ActivityLogsService],
})
export class GroupsModule {}
