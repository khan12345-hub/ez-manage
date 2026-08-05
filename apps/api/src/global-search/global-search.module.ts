import { Module } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchController } from './global-search.controller';
import { PrismaService } from 'prisma/prisma.service';
import { BoardSearchService } from 'src/boards/board-search.service';

@Module({
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService, PrismaService, BoardSearchService],
})
export class GlobalSearchModule {}
