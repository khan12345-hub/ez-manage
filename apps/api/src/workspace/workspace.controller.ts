import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';

import { WorkspaceService } from './workspace.service';
import { BoardsService } from 'src/boards/boards.service';

import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireWorkspacePermission } from 'src/auth/decorators/require-workspace-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { WorkspacePermissionGuard } from 'src/auth/guards/workspace-permission.guard';

import { WorkspacePermission } from '@repo/shared';

@Controller('workspaces')
@UseGuards(SessionAuthGuard, WorkspacePermissionGuard)
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly boardsService: BoardsService,
  ) {}

  @Post()
  create(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.workspaceService.create(createWorkspaceDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: SessionUser) {
    return this.workspaceService.findAll(user.id);
  }

  @Get(':workspaceId/boards')

  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  findAllBoards(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.findAll(workspaceId, user.id);
  }

  @Get(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  findOne(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.workspaceService.findOne(workspaceId);
  }

  @Patch(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.UPDATE)
  update(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.workspaceService.update(workspaceId, updateWorkspaceDto, user.id);
  }

  @Delete(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.DELETE)
  remove(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceService.remove(workspaceId);
  }
}