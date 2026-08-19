import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardAccessService } from './board-access.service';
import { BoardSearchService } from './board-search.service';
import { BoardImportService } from './board-import.service';
import { ColumnsAccessService } from './update-column-access.service';
import { BoardAccessManagementService } from './board-access-management.service';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, WorkspaceAccessService, BoardAccessService, BoardSearchService, BoardImportService, ColumnsAccessService, BoardAccessManagementService],
})
export class BoardsModule {}
