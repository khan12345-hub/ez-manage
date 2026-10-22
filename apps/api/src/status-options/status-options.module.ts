import { Module } from '@nestjs/common';
import { StatusOptionsController } from './status-options.controller';
import { StatusOptionsService } from './status-options.service';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [StatusOptionsController],
  providers: [
    StatusOptionsService,
    PrismaService,
    BoardAccessService,
  ],
  exports: [StatusOptionsService],
})
export class StatusOptionsModule {}
