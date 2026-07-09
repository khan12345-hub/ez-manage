import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, WorkspaceAccessService],
})
export class BoardsModule {}
