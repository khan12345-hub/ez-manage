import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, PrismaService, BoardAccessService],
})
export class TasksModule {}
