import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, PrismaService, BoardAccessService],
})
export class GroupsModule {}
