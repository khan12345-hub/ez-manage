import { Module } from '@nestjs/common';
import { BoardDocumentsController } from './board-documents.controller';
import { BoardDocumentsService } from './board-documents.service';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';

@Module({
  controllers: [BoardDocumentsController],
  providers: [BoardDocumentsService, PrismaService, BoardAccessService],
})
export class BoardDocumentsModule {}
