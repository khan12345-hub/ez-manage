import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
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
import { WorkspaceMemberRole } from 'generated/prisma/enums';

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
  async findAllBoards(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.boardsService.findAll(id, user.id);
  }

  @Get(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.VIEW)
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.findOne(id);
  }

  @Patch(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.UPDATE)
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.update(id, updateWorkspaceDto, user.id);
  }

  @Delete(':workspaceId')
  @RequireWorkspacePermission(WorkspacePermission.DELETE)
  async remove(
    @Param('workspaceId') workspaceId: string,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.remove(id);
  }

  @Patch(':workspaceId/members/:memberId')
  @RequireWorkspacePermission(WorkspacePermission.CHANGE_MEMBER_ROLE)
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: WorkspaceMemberRole,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.updateMemberRole(id, Number(memberId), role, user.id);
  }

  @Delete(':workspaceId/members/:memberId')
  @RequireWorkspacePermission(WorkspacePermission.REMOVE_MEMBERS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Query('force') force: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.removeMember(id, Number(memberId), user.id, force === 'true');
  }

  @Get(':workspaceId/members/:userId/tasks')
  async getMemberTasks(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.getMemberTasks(id, Number(userId));
  }

  @Get(':workspaceId/members/:userId/activity')
  async getMemberActivity(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.getMemberActivity(id, Number(userId));
  }

  @Get(':workspaceId/capacity')
  async getCapacity(@Param('workspaceId') workspaceId: string) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.getCapacity(id);
  }

  @Get(':workspaceId/calendar-tasks')
  async getCalendarTasks(
    @Param('workspaceId') workspaceId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const id = await this.workspaceService.resolveId(workspaceId);
    return this.workspaceService.getCalendarTasks(
      id,
      parseInt(month, 10),
      parseInt(year, 10),
    );
  }
}
