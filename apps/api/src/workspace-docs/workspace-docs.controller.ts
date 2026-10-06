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

@Controller('workspaces/:workspaceId/docs')
@UseGuards(SessionAuthGuard, WorkspacePermissionGuard)
export class WorkspaceDocsController {
  constructor(private readonly service: WorkspaceDocsService) {}

  @Get()
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  findAll(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.findAll(workspaceId, user.id);
  }

  @Get(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  findOne(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.findOne(id, workspaceId, user.id);
  }

  @Post()
  @RequireWorkspacePermission(WorkspacePermission.EDIT)
  create(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateWorkspaceDocDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.create(workspaceId, user.id, dto);
  }

  @Patch(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  update(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkspaceDocDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.update(id, workspaceId, user.id, dto);
  }

  @Delete(':id')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  remove(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.remove(id, workspaceId, user.id);
  }
}
