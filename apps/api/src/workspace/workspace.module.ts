import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { BoardsService } from 'src/boards/boards.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardSearchService } from 'src/boards/board-search.service';
import { BoardImportService } from 'src/boards/board-import.service';
import { FileImportModule } from 'src/file-import/file-import.module';

@Module({
  imports: [FileImportModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, BoardsService, WorkspaceAccessService, BoardAccessService, BoardSearchService, BoardImportService],

})
export class WorkspaceModule {}
