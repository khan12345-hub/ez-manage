import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, UseGuards,
} from '@nestjs/common';

import { WorkspaceDocsService } from './workspace-docs.service';
import { CreateWorkspaceDocDto } from './dto/create-workspace-doc.dto';
import { UpdateWorkspaceDocDto } from './dto/update-workspace-doc.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireWorkspacePermission } from 'src/auth/decorators/require-workspace-permission.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { WorkspacePermissionGuard } from 'src/auth/guards/workspace-permission.guard';
import { WorkspacePermission } from '@repo/shared';
import { WorkspaceService } from 'src/workspace/workspace.service';

@Controller('workspaces/:workspaceId/docs')
@UseGuards(SessionAuthGuard, WorkspacePermissionGuard)
export class WorkspaceDocsController {
  constructor(
    private readonly service: WorkspaceDocsService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Get()
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  async findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.service.findAll(id, user.id);
  }

  @Get(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    const wsId = await this.workspaceService.resolveId(workspaceId);
    return this.service.findOne(id, wsId, user.id);
  }

  @Post()
  @RequireWorkspacePermission(WorkspacePermission.EDIT)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkspaceDocDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.service.create(id, user.id, dto);
  }

  @Patch(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkspaceDocDto,
    @CurrentUser() user: SessionUser,
  ) {
    const wsId = await this.workspaceService.resolveId(workspaceId);
    return this.service.update(id, wsId, user.id, dto);
  }

  @Delete(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    const wsId = await this.workspaceService.resolveId(workspaceId);
    return this.service.remove(id, wsId, user.id);
  }
}
