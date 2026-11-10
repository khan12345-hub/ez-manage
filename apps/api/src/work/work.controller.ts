import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkFilesService, type AttachmentSource } from './work-files.service';
import { WorkPeopleService } from './work-people.service';
import { WorkInboxService } from './work-inbox.service';
import { WorkOverviewService } from './work-overview.service';
import { WorkFieldsService } from './work-fields.service';
import { WorkRemindersService } from './work-reminders.service';
import { WorkExtrasService } from './work-extras.service';
import { WorkStatsService, type StatsKind } from './work-stats.service';
import { ToggleDto, WatchDto, AssignCommentDto, ListRefDto, CreateReminderDto, UpdateReminderDto, CreateFieldDto, FieldValueDto, InboxBulkDto, NotificationPrefDto, ReactionDto, UpdateFieldDto } from './dto/work.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkService } from './work.service';
import { WorkDetailService } from './work-detail.service';
import {
  CreateChecklistDto,
  CreateChecklistItemDto,
  CreateCommentDto,
  CreateLinkDto,
  CreateTagDto,
  CreateWebLinkDto,
  WorkInviteDto,
  WorkRoleDto,
  ManualTimeDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
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
  constructor(
    private readonly work: WorkService,
    private readonly detail: WorkDetailService,
    private readonly files: WorkFilesService,
    private readonly people: WorkPeopleService,
    private readonly inbox: WorkInboxService,
    private readonly overview: WorkOverviewService,
    private readonly fields: WorkFieldsService,
    private readonly reminders: WorkRemindersService,
    private readonly extras: WorkExtrasService,
    private readonly stats: WorkStatsService,
  ) {}

  // ── workspace level ──
  @Get('workspaces/:workspaceId/tree')
  async tree(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.work.tree(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/all-tasks')
  async allTasks(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.work.allTasks(await this.work.resolveWorkspaceId(ws), u.id);
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

  // ── tags ──
  @Get('spaces/:id/tags')
  listTags(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.listTags(id, u.id);
  }

  @Post('spaces/:id/tags')
  createTag(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTagDto, @CurrentUser() u: SessionUser) {
    return this.detail.createTag(id, u.id, dto);
  }

  @Delete('tags/:id')
  deleteTag(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.deleteTag(id, u.id);
  }

  // ── checklists ──
  @Post('tasks/:id/checklists')
  createChecklist(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateChecklistDto, @CurrentUser() u: SessionUser) {
    return this.detail.createChecklist(id, u.id, dto);
  }

  @Patch('checklists/:id')
  updateChecklist(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChecklistDto, @CurrentUser() u: SessionUser) {
    return this.detail.updateChecklist(id, u.id, dto);
  }

  @Delete('checklists/:id')
  deleteChecklist(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.deleteChecklist(id, u.id);
  }

  @Post('checklists/:id/items')
  addChecklistItem(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateChecklistItemDto, @CurrentUser() u: SessionUser) {
    return this.detail.addChecklistItem(id, u.id, dto);
  }

  @Patch('checklist-items/:id')
  updateChecklistItem(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChecklistItemDto, @CurrentUser() u: SessionUser) {
    return this.detail.updateChecklistItem(id, u.id, dto);
  }

  @Delete('checklist-items/:id')
  deleteChecklistItem(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.deleteChecklistItem(id, u.id);
  }

  // ── dependencies / links ──
  @Post('tasks/:id/links')
  addLink(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLinkDto, @CurrentUser() u: SessionUser) {
    return this.detail.addLink(id, u.id, dto);
  }

  @Delete('links/:id')
  removeLink(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.removeLink(id, u.id);
  }

  // ── time tracking ──
  @Get('tasks/:id/time')
  listTime(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.listTime(id, u.id);
  }

  @Post('tasks/:id/time/start')
  startTimer(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.startTimer(id, u.id);
  }

  @Post('time/stop')
  stopTimer(@CurrentUser() u: SessionUser) {
    return this.detail.stopTimer(u.id);
  }

  @Get('time/running')
  myRunning(@CurrentUser() u: SessionUser) {
    return this.detail.myRunning(u.id);
  }

  @Post('tasks/:id/time')
  addManualTime(@Param('id', ParseIntPipe) id: number, @Body() dto: ManualTimeDto, @CurrentUser() u: SessionUser) {
    return this.detail.addManualTime(id, u.id, dto);
  }

  @Delete('time/:id')
  deleteTime(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.deleteTime(id, u.id);
  }

  // ── assigned comments + activity ──
  @Post('comments/:id/resolve')
  resolveComment(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.setCommentResolved(id, u.id, true);
  }

  @Post('comments/:id/reopen')
  reopenComment(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.setCommentResolved(id, u.id, false);
  }

  @Get('workspaces/:workspaceId/assigned-comments')
  async assignedComments(
    @Param('workspaceId') ws: string,
    @Query('mode') mode: string,
    @Query('resolved') resolved: string,
    @CurrentUser() u: SessionUser,
  ) {
    return this.detail.assignedComments(await this.work.resolveWorkspaceId(ws), u.id, mode === 'by-me' ? 'by-me' : 'to-me', resolved === 'true');
  }

  @Get('tasks/:id/activity')
  activity(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.detail.activity(id, u.id);
  }

  // ── attachments ──
  @Get('tasks/:id/attachments')
  attachments(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.files.listAttachments(id, u.id);
  }

  @Post('tasks/:id/attachments')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('source') source: string,
    @CurrentUser() u: SessionUser,
  ) {
    return this.files.upload(id, u.id, files ?? [], (source || 'task') as AttachmentSource);
  }

  @Delete('attachments/:id')
  deleteAttachment(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.files.deleteAttachment(id, u.id);
  }

  // ── web links ──
  @Get('tasks/:id/web-links')
  webLinks(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.files.listLinks(id, u.id);
  }

  @Post('tasks/:id/web-links')
  addWebLink(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateWebLinkDto, @CurrentUser() u: SessionUser) {
    return this.files.addLink(id, u.id, dto.url, dto.title);
  }

  @Delete('web-links/:id')
  deleteWebLink(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.files.deleteLink(id, u.id);
  }

  // ── people & access (Work's own membership, separate from Boards) ──
  @Get('space-templates')
  spaceTemplates() {
    return this.work.spaceTemplates();
  }

  // ── overview / dashboard numbers ──
  @Get('stats/:kind/:idOrUid')
  locationStats(@Param('kind') kind: string, @Param('idOrUid') idOrUid: string, @CurrentUser() u: SessionUser) {
    return this.stats.get(kind as StatsKind, idOrUid, u.id);
  }

  // ── comment extras ──
  @Post('comments/:id/assign')
  assignComment(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignCommentDto, @CurrentUser() u: SessionUser) {
    return this.extras.assignComment(id, u.id, dto.assigneeId);
  }

  @Post('comments/:id/unread')
  commentUnread(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.extras.markCommentUnread(id, u.id);
  }

  @Put('comments/:id/follow')
  followComment(@Param('id', ParseIntPipe) id: number, @Body() dto: ToggleDto, @CurrentUser() u: SessionUser) {
    return this.extras.followComment(id, u.id, dto.on);
  }

  // ── task extras ──
  @Get('tasks/:id/me')
  taskMine(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.extras.mine(id, u.id);
  }

  @Put('tasks/:id/watch')
  watchTask(@Param('id', ParseIntPipe) id: number, @Body() dto: WatchDto, @CurrentUser() u: SessionUser) {
    return this.extras.setWatch(id, u.id, dto.following);
  }

  @Put('tasks/:id/favorite')
  favoriteTask(@Param('id', ParseIntPipe) id: number, @Body() dto: ToggleDto, @CurrentUser() u: SessionUser) {
    return this.extras.setFavorite(id, u.id, dto.on);
  }

  @Get('workspaces/:workspaceId/favorites')
  async favorites(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.extras.favorites(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('tasks/:id/duplicate')
  duplicateTask(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.extras.duplicate(id, u.id);
  }

  @Get('tasks/:id/lists')
  taskLists(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.extras.otherLists(id, u.id);
  }

  @Post('tasks/:id/lists')
  addTaskToList(@Param('id', ParseIntPipe) id: number, @Body() dto: ListRefDto, @CurrentUser() u: SessionUser) {
    return this.extras.addToList(id, u.id, dto.listId);
  }

  @Delete('tasks/:id/lists/:listId')
  removeTaskFromList(@Param('id', ParseIntPipe) id: number, @Param('listId', ParseIntPipe) listId: number, @CurrentUser() u: SessionUser) {
    return this.extras.removeFromList(id, u.id, listId);
  }

  @Post('tasks/:id/lists/:listId/home')
  setTaskHome(@Param('id', ParseIntPipe) id: number, @Param('listId', ParseIntPipe) listId: number, @CurrentUser() u: SessionUser) {
    return this.extras.setHome(id, u.id, listId);
  }

  // ── reminders ──
  @Get('workspaces/:workspaceId/reminders')
  async myReminders(@Param('workspaceId') ws: string, @Query('done') done: string, @CurrentUser() u: SessionUser) {
    return this.reminders.mine(await this.work.resolveWorkspaceId(ws), u.id, done === 'true');
  }

  @Post('workspaces/:workspaceId/reminders')
  async createReminder(@Param('workspaceId') ws: string, @Body() dto: CreateReminderDto, @CurrentUser() u: SessionUser) {
    return this.reminders.create(await this.work.resolveWorkspaceId(ws), u.id, dto);
  }

  @Patch('reminders/:id')
  updateReminder(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReminderDto, @CurrentUser() u: SessionUser) {
    return this.reminders.update(id, u.id, dto);
  }

  @Delete('reminders/:id')
  deleteReminder(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.reminders.remove(id, u.id);
  }

  // ── custom fields ──
  @Get('spaces/:id/fields')
  listFields(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.fields.list(id, u.id);
  }

  @Post('spaces/:id/fields')
  createField(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateFieldDto, @CurrentUser() u: SessionUser) {
    return this.fields.create(id, u.id, dto);
  }

  @Patch('fields/:id')
  updateField(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFieldDto, @CurrentUser() u: SessionUser) {
    return this.fields.update(id, u.id, dto);
  }

  @Delete('fields/:id')
  deleteField(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.fields.remove(id, u.id);
  }

  @Get('lists/:id/field-values')
  listFieldValues(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.fields.valuesForList(id, u.id);
  }

  @Get('tasks/:id/field-values')
  taskFieldValues(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.fields.valuesForTask(id, u.id);
  }

  @Put('tasks/:id/fields/:fieldId')
  setFieldValue(@Param('id', ParseIntPipe) id: number, @Param('fieldId', ParseIntPipe) fieldId: number, @Body() dto: FieldValueDto, @CurrentUser() u: SessionUser) {
    return this.fields.setValue(id, fieldId, u.id, dto.value);
  }

  // ── space / folder overview ──
  @Get('spaces/:idOrUid/overview')
  spaceOverview(@Param('idOrUid') id: string, @CurrentUser() u: SessionUser) {
    return this.overview.space(id, u.id);
  }

  @Get('folders/:idOrUid/overview')
  folderOverview(@Param('idOrUid') id: string, @CurrentUser() u: SessionUser) {
    return this.overview.folder(id, u.id);
  }

  // ── comment reactions ──
  @Post('comments/:id/reactions')
  react(@Param('id', ParseIntPipe) id: number, @Body() dto: ReactionDto, @CurrentUser() u: SessionUser) {
    return this.files.toggleReaction(id, u.id, dto.emoji);
  }

  // ── my Work notification settings (per event: inbox / email / browser) ──
  @Get('notification-settings')
  notificationSettings(@CurrentUser() u: SessionUser) {
    return this.files.getSettings(u.id);
  }

  @Put('notification-settings')
  setNotificationSetting(@Body() dto: NotificationPrefDto, @CurrentUser() u: SessionUser) {
    return this.files.setSetting(u.id, dto.kind, { inbox: dto.inbox, email: dto.email, browser: dto.browser });
  }

  // ── inbox (Work notifications only) ──
  @Get('inbox')
  workInbox(@Query('view') view: string, @CurrentUser() u: SessionUser) {
    const v = view === 'later' || view === 'cleared' || view === 'all' ? view : 'active';
    return this.inbox.list(u.id, v);
  }

  @Patch('inbox')
  workInboxBulk(@Body() dto: InboxBulkDto, @CurrentUser() u: SessionUser) {
    return this.inbox.bulk(u.id, dto.ids, dto.action, dto.until);
  }

  @Get('my-workspaces')
  myWorkspaces(@CurrentUser() u: SessionUser) {
    return this.people.myWorkspaces(u.id);
  }

  @Get('workspaces/:workspaceId/people')
  async listPeople(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.people.people(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/invites')
  async invite(@Param('workspaceId') ws: string, @Body() dto: WorkInviteDto, @CurrentUser() u: SessionUser) {
    return this.people.invite(await this.work.resolveWorkspaceId(ws), u.id, dto.emails, dto.role);
  }

  @Patch('workspaces/:workspaceId/people/:userId')
  async changeRole(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) target: number, @Body() dto: WorkRoleDto, @CurrentUser() u: SessionUser) {
    return this.people.changeRole(await this.work.resolveWorkspaceId(ws), u.id, target, dto.role);
  }

  @Delete('workspaces/:workspaceId/people/:userId')
  async removePerson(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) target: number, @CurrentUser() u: SessionUser) {
    return this.people.remove(await this.work.resolveWorkspaceId(ws), u.id, target);
  }

  @Delete('invites/:id')
  revokeInvite(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.people.revokeInvite(id, u.id);
  }

  @Get('spaces/:id/members')
  spaceMembers(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.people.spaceMembers(id, u.id);
  }
}
