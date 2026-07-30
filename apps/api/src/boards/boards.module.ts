import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardAccessService } from './board-access.service';
import { BoardSearchService } from './board-search.service';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, WorkspaceAccessService, BoardAccessService, BoardSearchService],
})
export class BoardsModule {}
