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
import { WorkProfileService } from './work-profile.service';
import { WorkAutomationsService } from './work-automations.service';
import { WorkChatService } from './work-chat.service';
import { ChatToTaskDto, ChatRemindDto, ChatForwardDto, ChannelPermissionDto, CreateChannelDto, UpdateChannelDto, DmDto, ChannelMembersDto, ChannelPrefsDto, ChatSectionDto, ChatSectionOrderDto, ChannelSectionDto, ChannelViewDto, UpdateChannelViewDto, ScheduleChatDto, UpdateScheduledChatDto, ChatMessageDto, EditChatMessageDto, ChatDraftDto, CreateAutomationDto, UpdateAutomationDto, CreateWorkWorkspaceDto, UpdateWorkWorkspaceDto, DeleteWorkWorkspaceDto, UpdateProfileDto, PriorityDto, CreateTeamDto, UpdateTeamDto, ToggleDto, WatchDto, AssignCommentDto, ListRefDto, CreateReminderDto, UpdateReminderDto, CreateFieldDto, FieldValueDto, InboxBulkDto, NotificationPrefDto, ReactionDto, UpdateFieldDto } from './dto/work.dto';
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
    private readonly profiles: WorkProfileService,
    private readonly automations: WorkAutomationsService,
    private readonly chat: WorkChatService,
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
  // ── chat: channels, DMs, messages (separate from Boards chat) ──
  @Get('workspaces/:workspaceId/chat')
  async chatSidebar(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.sidebar(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/chat/channels')
  async createChannel(@Param('workspaceId') ws: string, @Body() dto: CreateChannelDto, @CurrentUser() u: SessionUser) {
    return this.chat.create(await this.work.resolveWorkspaceId(ws), u.id, dto);
  }

  @Post('workspaces/:workspaceId/chat/dm')
  async openDm(@Param('workspaceId') ws: string, @Body() dto: DmDto, @CurrentUser() u: SessionUser) {
    return this.chat.dm(await this.work.resolveWorkspaceId(ws), u.id, dto.userIds);
  }

  @Get('workspaces/:workspaceId/chat/drafts')
  async chatDrafts(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.drafts(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/chat/sent')
  async chatSent(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.sent(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/chat/saved')
  async chatSaved(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.saved(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/chat/activity')
  async chatActivity(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.activity(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/chat/posts')
  async chatPosts(@Param('workspaceId') ws: string, @Query('type') type: string, @CurrentUser() u: SessionUser) {
    return this.chat.posts(await this.work.resolveWorkspaceId(ws), u.id, type);
  }

  @Post('workspaces/:workspaceId/chat/files')
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }))
  async chatFiles(@Param('workspaceId') ws: string, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: SessionUser) {
    return this.chat.upload(await this.work.resolveWorkspaceId(ws), u.id, files);
  }

  @Get('chat/channels/:uid')
  channelDetail(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.detail(uid, u.id);
  }

  @Patch('chat/channels/:uid')
  updateChannel(@Param('uid') uid: string, @Body() dto: UpdateChannelDto, @CurrentUser() u: SessionUser) {
    return this.chat.update(uid, u.id, dto);
  }

  @Delete('chat/channels/:uid')
  archiveChannel(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.archive(uid, u.id);
  }

  @Post('chat/channels/:uid/join')
  joinChannel(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.join(uid, u.id);
  }

  @Post('chat/channels/:uid/leave')
  leaveChannel(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.leave(uid, u.id);
  }

  @Post('chat/channels/:uid/members')
  addChannelMembers(@Param('uid') uid: string, @Body() dto: ChannelMembersDto, @CurrentUser() u: SessionUser) {
    return this.chat.addMembers(uid, u.id, dto.userIds);
  }

  @Delete('chat/channels/:uid/members/:userId')
  removeChannelMember(@Param('uid') uid: string, @Param('userId', ParseIntPipe) target: number, @CurrentUser() u: SessionUser) {
    return this.chat.removeMember(uid, u.id, target);
  }

  @Put('chat/channels/:uid/prefs')
  channelPrefs(@Param('uid') uid: string, @Body() dto: ChannelPrefsDto, @CurrentUser() u: SessionUser) {
    return this.chat.setPrefs(uid, u.id, dto);
  }

  @Post('chat/channels/:uid/unread')
  unreadChannel(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.markUnread(uid, u.id);
  }

  @Post('chat/channels/:uid/close')
  closeDm(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.closeDm(uid, u.id);
  }

  @Put('chat/channels/:uid/permissions/:userId')
  channelPermission(@Param('uid') uid: string, @Param('userId', ParseIntPipe) target: number, @Body() dto: ChannelPermissionDto, @CurrentUser() u: SessionUser) {
    return this.chat.setPermission(uid, u.id, target, dto.permission);
  }

  @Put('chat/channels/:uid/permissions')
  channelPermissionsAll(@Param('uid') uid: string, @Body() dto: ChannelPermissionDto, @CurrentUser() u: SessionUser) {
    return this.chat.setAllPermissions(uid, u.id, dto.permission);
  }

  @Post('workspaces/:workspaceId/chat/read-all')
  async chatReadAll(@Param('workspaceId') ws: string, @Query('section') section: string, @CurrentUser() u: SessionUser) {
    return this.chat.markAllRead(await this.work.resolveWorkspaceId(ws), u.id, /^\d+$/.test(section ?? '') ? Number(section) : section === 'dms' ? 'dms' : 'channels');
  }

  @Get('workspaces/:workspaceId/chat/search')
  async chatSearch(
    @Param('workspaceId') ws: string,
    @Query('q') q: string, @Query('from') from: string, @Query('in') inUid: string, @Query('after') after: string, @Query('before') before: string,
    @Query('has') has: string, @Query('mentions') mentions: string, @Query('kind') kind: string, @Query('cursor') cursor: string,
    @CurrentUser() u: SessionUser,
  ) {
    return this.chat.search(await this.work.resolveWorkspaceId(ws), u.id, {
      q, from: /^\d+$/.test(from ?? '') ? Number(from) : undefined, in: inUid || undefined, after, before,
      has: ['link', 'file', 'task'].includes(has) ? has : undefined, mentions: mentions === 'true', kind: kind === 'post' ? 'post' : undefined, cursor,
    });
  }

  @Get('workspaces/:workspaceId/chat/sections')
  async chatSections(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.chat.sections(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/chat/sections')
  async createChatSection(@Param('workspaceId') ws: string, @Body() dto: ChatSectionDto, @CurrentUser() u: SessionUser) {
    return this.chat.createSection(await this.work.resolveWorkspaceId(ws), u.id, dto.name);
  }

  @Put('workspaces/:workspaceId/chat/sections/order')
  async reorderChatSections(@Param('workspaceId') ws: string, @Body() dto: ChatSectionOrderDto, @CurrentUser() u: SessionUser) {
    return this.chat.reorderSections(await this.work.resolveWorkspaceId(ws), u.id, dto.ids);
  }

  @Patch('chat/sections/:id')
  renameChatSection(@Param('id', ParseIntPipe) id: number, @Body() dto: ChatSectionDto, @CurrentUser() u: SessionUser) {
    return this.chat.renameSection(id, u.id, dto.name);
  }

  @Delete('chat/sections/:id')
  deleteChatSection(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.deleteSection(id, u.id);
  }

  @Get('chat/channels/:uid/files')
  channelFiles(@Param('uid') uid: string, @Query('type') type: string, @Query('q') q: string, @Query('cursor') cursor: string, @CurrentUser() u: SessionUser) {
    return this.chat.channelFiles(uid, u.id, { type: ['images', 'docs', 'media', 'other'].includes(type) ? type : undefined, q, cursor });
  }

  @Post('chat/channels/:uid/scheduled')
  scheduleChat(@Param('uid') uid: string, @Body() dto: ScheduleChatDto, @CurrentUser() u: SessionUser) {
    return this.chat.schedule(uid, u.id, dto);
  }

  @Get('workspaces/:workspaceId/chat/scheduled')
  async chatScheduled(@Param('workspaceId') ws: string, @Query('channel') channel: string, @CurrentUser() u: SessionUser) {
    return this.chat.scheduledList(await this.work.resolveWorkspaceId(ws), u.id, channel || undefined);
  }

  @Patch('chat/scheduled/:id')
  updateScheduledChat(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateScheduledChatDto, @CurrentUser() u: SessionUser) {
    return this.chat.updateScheduled(id, u.id, dto);
  }

  @Delete('chat/scheduled/:id')
  deleteScheduledChat(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.deleteScheduled(id, u.id);
  }

  @Post('chat/scheduled/:id/send')
  sendScheduledChat(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.sendScheduledNow(id, u.id);
  }

  @Get('chat/channels/:uid/views')
  channelViews(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.views(uid, u.id);
  }

  @Post('chat/channels/:uid/views')
  addChannelView(@Param('uid') uid: string, @Body() dto: ChannelViewDto, @CurrentUser() u: SessionUser) {
    return this.chat.addView(uid, u.id, dto);
  }

  @Put('chat/channels/:uid/views/order')
  reorderChannelViews(@Param('uid') uid: string, @Body() dto: ChatSectionOrderDto, @CurrentUser() u: SessionUser) {
    return this.chat.reorderViews(uid, u.id, dto.ids);
  }

  @Patch('chat/views/:id')
  updateChannelView(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChannelViewDto, @CurrentUser() u: SessionUser) {
    return this.chat.updateView(id, u.id, dto);
  }

  @Delete('chat/views/:id')
  deleteChannelView(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.deleteView(id, u.id);
  }

  @Put('chat/channels/:uid/section')
  moveChannelToSection(@Param('uid') uid: string, @Body() dto: ChannelSectionDto, @CurrentUser() u: SessionUser) {
    return this.chat.moveToSection(uid, u.id, dto.sectionId ?? null);
  }

  @Post('chat/channels/:uid/read')
  readChannel(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.markRead(uid, u.id);
  }

  @Post('chat/channels/:uid/typing')
  typing(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.chat.typing(uid, u.id);
  }

  @Put('chat/channels/:uid/draft')
  chatDraft(@Param('uid') uid: string, @Body() dto: ChatDraftDto, @CurrentUser() u: SessionUser) {
    return this.chat.setDraft(uid, u.id, dto.content, dto.parentId ?? 0);
  }

  @Get('chat/channels/:uid/messages')
  chatMessages(@Param('uid') uid: string, @Query('before') before: string, @Query('q') q: string, @Query('posts') posts: string, @CurrentUser() u: SessionUser) {
    return this.chat.messages(uid, u.id, { before, q, posts: posts === 'true' });
  }

  @Post('chat/channels/:uid/messages')
  sendChat(@Param('uid') uid: string, @Body() dto: ChatMessageDto, @CurrentUser() u: SessionUser) {
    return this.chat.send(uid, u.id, dto);
  }

  @Post('chat/messages/:id/task')
  chatToTask(@Param('id', ParseIntPipe) id: number, @Body() dto: ChatToTaskDto, @CurrentUser() u: SessionUser) {
    return this.chat.toTask(id, u.id, dto);
  }

  @Post('chat/messages/:id/assign')
  chatAssign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignCommentDto, @CurrentUser() u: SessionUser) {
    return this.chat.assign(id, u.id, dto.assigneeId);
  }

  @Post('chat/messages/:id/resolve')
  chatResolve(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.resolve(id, u.id, true);
  }

  @Post('chat/messages/:id/reopen')
  chatReopen(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.resolve(id, u.id, false);
  }

  @Post('chat/messages/:id/remind')
  chatRemind(@Param('id', ParseIntPipe) id: number, @Body() dto: ChatRemindDto, @CurrentUser() u: SessionUser) {
    return this.chat.remind(id, u.id, dto.remindAt);
  }

  @Post('chat/messages/:id/forward')
  chatForward(@Param('id', ParseIntPipe) id: number, @Body() dto: ChatForwardDto, @CurrentUser() u: SessionUser) {
    return this.chat.forward(id, u.id, dto.channelUid, dto.note);
  }

  @Get('workspaces/:workspaceId/chat/assigned')
  async chatAssigned(@Param('workspaceId') ws: string, @Query('resolved') resolved: string, @CurrentUser() u: SessionUser) {
    return this.chat.assignedToMe(await this.work.resolveWorkspaceId(ws), u.id, resolved === 'true');
  }

  @Get('chat/messages/:id/thread')
  chatThread(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.thread(id, u.id);
  }

  @Patch('chat/messages/:id')
  editChat(@Param('id', ParseIntPipe) id: number, @Body() dto: EditChatMessageDto, @CurrentUser() u: SessionUser) {
    return this.chat.edit(id, u.id, dto);
  }

  @Delete('chat/messages/:id')
  deleteChat(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.chat.remove(id, u.id);
  }

  @Post('chat/messages/:id/reactions')
  reactChat(@Param('id', ParseIntPipe) id: number, @Body() dto: ReactionDto, @CurrentUser() u: SessionUser) {
    return this.chat.react(id, u.id, dto.emoji);
  }

  @Put('chat/messages/:id/pin')
  pinChat(@Param('id', ParseIntPipe) id: number, @Body() dto: ToggleDto, @CurrentUser() u: SessionUser) {
    return this.chat.pin(id, u.id, dto.on);
  }

  @Put('chat/messages/:id/save')
  saveChat(@Param('id', ParseIntPipe) id: number, @Body() dto: ToggleDto, @CurrentUser() u: SessionUser) {
    return this.chat.save(id, u.id, dto.on);
  }

  // ── automations ──
  @Get('spaces/:id/automations')
  listAutomations(@Param('id', ParseIntPipe) id: number, @Query('folderId') folderId: string, @Query('listId') listId: string, @CurrentUser() u: SessionUser) {
    return this.automations.list(id, u.id, folderId ? Number(folderId) : undefined, listId ? Number(listId) : undefined);
  }

  @Post('spaces/:id/automations')
  createAutomation(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateAutomationDto, @CurrentUser() u: SessionUser) {
    return this.automations.create(id, u.id, dto);
  }

  @Patch('automations/:id')
  updateAutomation(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAutomationDto, @CurrentUser() u: SessionUser) {
    return this.automations.update(id, u.id, dto);
  }

  @Delete('automations/:id')
  deleteAutomation(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.automations.remove(id, u.id);
  }

  @Get('automations/:id/runs')
  automationRuns(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.automations.runs(id, u.id);
  }

  // ── Work workspaces (separate from Boards) ──
  @Post('workspaces')
  createWorkWorkspace(@Body() dto: CreateWorkWorkspaceDto, @CurrentUser() u: SessionUser) {
    return this.people.createWorkspace(u.id, dto);
  }

  @Patch('workspaces/:workspaceId')
  async updateWorkWorkspace(@Param('workspaceId') ws: string, @Body() dto: UpdateWorkWorkspaceDto, @CurrentUser() u: SessionUser) {
    return this.people.updateWorkspace(await this.work.resolveWorkspaceId(ws), u.id, dto);
  }

  @Delete('workspaces/:workspaceId')
  async deleteWorkWorkspace(@Param('workspaceId') ws: string, @Body() dto: DeleteWorkWorkspaceDto, @CurrentUser() u: SessionUser) {
    return this.people.deleteWorkspace(await this.work.resolveWorkspaceId(ws), u.id, dto.confirmName);
  }

  // ── people: directory, profiles, teams, analytics ──
  @Get('workspaces/:workspaceId/directory')
  async directory(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.profiles.directory(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Get('workspaces/:workspaceId/profiles/:userId')
  async profile(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.profiles.profile(await this.work.resolveWorkspaceId(ws), u.id, id);
  }

  @Get('workspaces/:workspaceId/profiles/:userId/tasks')
  async profileTasks(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.profiles.tasks(await this.work.resolveWorkspaceId(ws), u.id, id);
  }

  @Get('workspaces/:workspaceId/profiles/:userId/comments')
  async profileComments(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @Query('resolved') resolved: string, @CurrentUser() u: SessionUser) {
    return this.profiles.comments(await this.work.resolveWorkspaceId(ws), u.id, id, resolved === 'true');
  }

  @Get('workspaces/:workspaceId/profiles/:userId/activity')
  async profileActivity(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.profiles.activity(await this.work.resolveWorkspaceId(ws), u.id, id);
  }

  @Patch('workspaces/:workspaceId/profiles/:userId')
  async updateProfile(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @Body() dto: UpdateProfileDto, @CurrentUser() u: SessionUser) {
    return this.profiles.update(await this.work.resolveWorkspaceId(ws), u.id, id, dto);
  }

  @Post('workspaces/:workspaceId/profiles/:userId/priorities')
  async addPriority(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @Body() dto: PriorityDto, @CurrentUser() u: SessionUser) {
    return this.profiles.addPriority(await this.work.resolveWorkspaceId(ws), u.id, id, dto.taskId);
  }

  @Delete('workspaces/:workspaceId/profiles/:userId/priorities/:taskId')
  async removePriority(@Param('workspaceId') ws: string, @Param('userId', ParseIntPipe) id: number, @Param('taskId', ParseIntPipe) taskId: number, @CurrentUser() u: SessionUser) {
    return this.profiles.removePriority(await this.work.resolveWorkspaceId(ws), u.id, id, taskId);
  }

  @Post('workspaces/:workspaceId/teams')
  async createTeam(@Param('workspaceId') ws: string, @Body() dto: CreateTeamDto, @CurrentUser() u: SessionUser) {
    return this.profiles.createTeam(await this.work.resolveWorkspaceId(ws), u.id, dto);
  }

  @Patch('teams/:id')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto, @CurrentUser() u: SessionUser) {
    return this.profiles.updateTeam(id, u.id, dto);
  }

  @Delete('teams/:id')
  deleteTeam(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.profiles.deleteTeam(id, u.id);
  }

  @Get('workspaces/:workspaceId/analytics')
  async analytics(@Param('workspaceId') ws: string, @Query('day') day: string, @CurrentUser() u: SessionUser) {
    return this.profiles.analytics(await this.work.resolveWorkspaceId(ws), u.id, day);
  }

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
