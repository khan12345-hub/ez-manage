import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { BoardAccessService } from './board-access.service';
import { BoardSearchService } from './board-search.service';
import { BoardImportService } from './board-import.service';
import { ColumnsAccessService } from './update-column-access.service';
import { BoardAccessManagementService } from './board-access-management.service';
import { GetBoardTasksService } from './single-board-tasks.service';
import { boardAllFilesService } from './board-all-files.service';
import { BoardExportService } from './board-export.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    WorkspaceAccessService,
    BoardAccessService,
    BoardSearchService,
    BoardImportService,
    ColumnsAccessService,
    BoardAccessManagementService,
    GetBoardTasksService,
    boardAllFilesService,
    BoardExportService,
  ],
})
export class BoardsModule {}
