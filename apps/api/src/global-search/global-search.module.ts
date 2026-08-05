import { Module } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchController } from './global-search.controller';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService, PrismaService],
})
export class GlobalSearchModule {}
