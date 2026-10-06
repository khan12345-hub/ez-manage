import { Module } from '@nestjs/common';
import { WorkspaceDocsService } from './workspace-docs.service';
import { WorkspaceDocsController } from './workspace-docs.controller';
import { WorkspaceAccessService } from 'src/workspace/workspace-access.service';

@Module({
  controllers: [WorkspaceDocsController],
  providers: [WorkspaceDocsService, WorkspaceAccessService],
})
export class WorkspaceDocsModule {}
