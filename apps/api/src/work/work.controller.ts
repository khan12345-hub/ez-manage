import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkService } from './work.service';
import {
  CreateCommentDto,
  CreateFolderDto,
  CreateListDto,
  CreateSpaceDto,
  CreateStatusDto,
  CreateTaskDto,
  SpaceMembersDto,
  UpdateCommentDto,
  UpdateFolderDto,
  UpdateListDto,
  UpdateSpaceDto,
  UpdateStatusDto,
  UpdateTaskDto,
} from './dto/work.dto';

/**
 * Work (ClickUp-style product). Session auth is global; every handler checks
 * workspace / space access in WorkService via WorkAccessService.
 */
@Controller('work')
export class WorkController {
  constructor(private readonly work: WorkService) {}

  // ── workspace level ──
  @Get('workspaces/:workspaceId/tree')
  async tree(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.work.tree(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/my-tasks')
  async myTasks(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.work.myTasks(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/spaces')
  async createSpace(@Param('workspaceId') ws: string, @Body() dto: CreateSpaceDto, @CurrentUser() u: SessionUser) {
    return this.work.createSpace(await this.work.resolveWorkspaceId(ws), u.id, dto);
  }

  // ── spaces ──
  @Patch('spaces/:id')
  updateSpace(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSpaceDto, @CurrentUser() u: SessionUser) {
    return this.work.updateSpace(id, u.id, dto);
  }

  @Delete('spaces/:id')
  archiveSpace(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.archiveSpace(id, u.id);
  }

  @Put('spaces/:id/members')
  setSpaceMembers(@Param('id', ParseIntPipe) id: number, @Body() dto: SpaceMembersDto, @CurrentUser() u: SessionUser) {
    return this.work.setSpaceMembers(id, u.id, dto.userIds);
  }

  @Post('spaces/:id/statuses')
  createSpaceStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateStatusDto, @CurrentUser() u: SessionUser) {
    return this.work.createSpaceStatus(id, u.id, dto);
  }

  @Post('spaces/:id/folders')
  createFolder(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateFolderDto, @CurrentUser() u: SessionUser) {
    return this.work.createFolder(id, u.id, dto);
  }

  @Post('spaces/:id/lists')
  createList(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateListDto, @CurrentUser() u: SessionUser) {
    return this.work.createList(id, u.id, dto);
  }

  // ── statuses ──
  @Patch('statuses/:id')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto, @CurrentUser() u: SessionUser) {
    return this.work.updateStatus(id, u.id, dto);
  }

  @Delete('statuses/:id')
  deleteStatus(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.deleteStatus(id, u.id);
  }

  // ── folders ──
  @Patch('folders/:id')
  updateFolder(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFolderDto, @CurrentUser() u: SessionUser) {
    return this.work.updateFolder(id, u.id, dto);
  }

  @Delete('folders/:id')
  archiveFolder(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.archiveFolder(id, u.id);
  }

  // ── lists ──
  @Get('lists/:idOrUid')
  getList(@Param('idOrUid') id: string, @CurrentUser() u: SessionUser) {
    return this.work.getList(id, u.id);
  }

  @Patch('lists/:id')
  updateList(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateListDto, @CurrentUser() u: SessionUser) {
    return this.work.updateList(id, u.id, dto);
  }

  @Delete('lists/:id')
  archiveList(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.archiveList(id, u.id);
  }

  @Get('lists/:id/tasks')
  listTasks(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.listTasks(id, u.id);
  }

  @Post('lists/:id/tasks')
  createTask(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTaskDto, @CurrentUser() u: SessionUser) {
    return this.work.createTask(id, u.id, dto);
  }

  // ── tasks ──
  @Get('tasks/:idOrUid')
  getTask(@Param('idOrUid') id: string, @CurrentUser() u: SessionUser) {
    return this.work.getTask(id, u.id);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto, @CurrentUser() u: SessionUser) {
    return this.work.updateTask(id, u.id, dto);
  }

  @Delete('tasks/:id')
  archiveTask(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.archiveTask(id, u.id);
  }

  // ── comments ──
  @Get('tasks/:id/comments')
  listComments(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.listComments(id, u.id);
  }

  @Post('tasks/:id/comments')
  createComment(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCommentDto, @CurrentUser() u: SessionUser) {
    return this.work.createComment(id, u.id, dto);
  }

  @Patch('comments/:id')
  updateComment(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommentDto, @CurrentUser() u: SessionUser) {
    return this.work.updateComment(id, u.id, dto);
  }

  @Delete('comments/:id')
  deleteComment(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.work.deleteComment(id, u.id);
  }
}
