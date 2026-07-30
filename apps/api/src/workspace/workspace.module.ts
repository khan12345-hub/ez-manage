import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { BoardsService } from 'src/boards/boards.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardSearchService } from 'src/boards/board-search.service';

@Module({
  controllers: [WorkspaceController],
  providers: [WorkspaceService, BoardsService, WorkspaceAccessService, BoardAccessService, BoardSearchService],
  
})
export class WorkspaceModule {}
