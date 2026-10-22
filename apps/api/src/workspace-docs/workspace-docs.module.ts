import { Module } from '@nestjs/common';
import { WorkspaceDocsService } from './workspace-docs.service';
import { WorkspaceDocsController } from './workspace-docs.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';
import { WorkspaceService } from 'src/workspace/workspace.service';

@Module({
  controllers: [WorkspaceDocsController],
  providers: [WorkspaceDocsService, WorkspaceAccessService, WorkspaceService],
})
export class WorkspaceDocsModule {}
