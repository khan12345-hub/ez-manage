import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkService } from './work.service';
import { WorkTimesheetService } from './work-timesheet.service';
import { WorkSprintsService } from './work-sprints.service';
import { WorkGoalsService } from './work-goals.service';
import { WorkDocsService } from './work-docs.service';
import { WorkFormsService } from './work-forms.service';
import { WorkAiService } from './work-ai.service';
import { WorkLinksService } from './work-links.service';
import { WorkWhiteboardsService } from './work-whiteboards.service';
import { WorkCallsService } from './work-calls.service';
import { WorkMoreService } from './work-more.service';
import { WorkChatService } from './work-chat.service';
import { PrismaService } from 'prisma/prisma.service';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/decorators/public.decorator';

/** Work modules: Timesheets, Sprints, Goals, Docs, Forms, Whiteboards (session auth is global). */
@Controller('work')
export class WorkModulesController {
  constructor(
    private readonly work: WorkService,
    private readonly timesheets: WorkTimesheetService,
    private readonly sprints: WorkSprintsService,
    private readonly goals: WorkGoalsService,
    private readonly docs: WorkDocsService,
    private readonly forms: WorkFormsService,
    private readonly ai: WorkAiService,
    private readonly links: WorkLinksService,
    private readonly boards: WorkWhiteboardsService,
    private readonly calls: WorkCallsService,
    private readonly more: WorkMoreService,
    private readonly chat: WorkChatService,
    private readonly prisma: PrismaService,
  ) {}

  // ── timesheets ──
  @Get('workspaces/:workspaceId/timesheet')
  async timesheet(@Param('workspaceId') ws: string, @Query('week') week: string, @Query('tz') tz: string, @Query('userId') userId: string, @CurrentUser() u: SessionUser) {
    return this.timesheets.mine(await this.work.resolveWorkspaceId(ws), u.id, String(week ?? ''), Number(tz ?? 0), /^\d+$/.test(userId ?? '') ? Number(userId) : undefined);
  }

  @Get('workspaces/:workspaceId/timesheet/team')
  async teamTimesheet(@Param('workspaceId') ws: string, @Query('week') week: string, @Query('tz') tz: string, @CurrentUser() u: SessionUser) {
    return this.timesheets.team(await this.work.resolveWorkspaceId(ws), u.id, String(week ?? ''), Number(tz ?? 0));
  }

  // ── sprints ──
  @Get('workspaces/:workspaceId/sprints')
  async listSprints(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.sprints.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/sprints')
  async createSprint(@Param('workspaceId') ws: string, @Body() b: { name?: string; goal?: string; startDate?: string; endDate?: string }, @CurrentUser() u: SessionUser) {
    return this.sprints.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Get('sprints/:id')
  sprint(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.sprints.detail(id, u.id);
  }

  @Patch('sprints/:id')
  updateSprint(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; goal?: string | null; startDate?: string; endDate?: string; status?: string }, @CurrentUser() u: SessionUser) {
    return this.sprints.update(id, u.id, b ?? {});
  }

  @Post('sprints/:id/tasks')
  sprintTasks(@Param('id', ParseIntPipe) id: number, @Body() b: { add?: number[]; remove?: number[] }, @CurrentUser() u: SessionUser) {
    return this.sprints.setTasks(id, u.id, Array.isArray(b?.add) ? b.add : [], Array.isArray(b?.remove) ? b.remove : []);
  }

  @Post('sprints/:id/complete')
  completeSprint(@Param('id', ParseIntPipe) id: number, @Body() b: { moveTo?: number | null }, @CurrentUser() u: SessionUser) {
    return this.sprints.complete(id, u.id, b?.moveTo ? Number(b.moveTo) : null);
  }

  @Delete('sprints/:id')
  deleteSprint(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.sprints.remove(id, u.id);
  }

  // ── goals ──
  @Get('workspaces/:workspaceId/goals')
  async listGoals(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.goals.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/goals')
  async createGoal(@Param('workspaceId') ws: string, @Body() b: { name?: string; description?: string; dueDate?: string | null; ownerId?: number; color?: string }, @CurrentUser() u: SessionUser) {
    return this.goals.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Patch('goals/:id')
  updateGoal(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; description?: string | null; dueDate?: string | null; ownerId?: number; color?: string }, @CurrentUser() u: SessionUser) {
    return this.goals.update(id, u.id, b ?? {});
  }

  @Delete('goals/:id')
  deleteGoal(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.goals.remove(id, u.id);
  }

  @Post('goals/:id/targets')
  addGoalTarget(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; kind?: string; startVal?: number; targetVal?: number; unit?: string; listId?: number }, @CurrentUser() u: SessionUser) {
    return this.goals.addTarget(id, u.id, b ?? {});
  }

  @Patch('goal-targets/:id')
  updateGoalTarget(@Param('id', ParseIntPipe) id: number, @Body() b: { current?: number; name?: string; targetVal?: number; startVal?: number }, @CurrentUser() u: SessionUser) {
    return this.goals.updateTarget(id, u.id, b ?? {});
  }

  @Delete('goal-targets/:id')
  deleteGoalTarget(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.goals.removeTarget(id, u.id);
  }

  // ── docs ──
  @Get('workspaces/:workspaceId/docs')
  async listDocs(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.docs.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/docs')
  async createDoc(@Param('workspaceId') ws: string, @Body() b: { title?: string; spaceId?: number | null; parentId?: number | null; content?: string }, @CurrentUser() u: SessionUser) {
    return this.docs.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Get('docs/:id')
  doc(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.docs.get(id, u.id);
  }

  @Patch('docs/:id')
  updateDoc(@Param('id') id: string, @Body() b: { title?: string; content?: string }, @CurrentUser() u: SessionUser) {
    return this.docs.update(id, u.id, b ?? {});
  }

  @Delete('docs/:id')
  archiveDoc(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.docs.archive(id, u.id);
  }

  // ── forms ──
  @Get('workspaces/:workspaceId/forms')
  async listForms(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.forms.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/forms')
  async createForm(@Param('workspaceId') ws: string, @Body() b: { name?: string; description?: string; listId?: number; fields?: unknown }, @CurrentUser() u: SessionUser) {
    return this.forms.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Patch('forms/:id')
  updateForm(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; description?: string | null; listId?: number; fields?: unknown; active?: boolean }, @CurrentUser() u: SessionUser) {
    return this.forms.update(id, u.id, b ?? {});
  }

  @Delete('forms/:id')
  deleteForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.forms.remove(id, u.id);
  }

  /** public: anyone with the link can open and submit (each answer becomes a task) */
  @Public()
  @Get('public/forms/:uid')
  publicForm(@Param('uid') uid: string) {
    return this.forms.publicForm(uid);
  }

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('public/forms/:uid')
  submitForm(@Param('uid') uid: string, @Body() b: { answers?: Record<string, unknown> }) {
    return this.forms.submit(uid, b?.answers ?? {});
  }

  // ── Work AI ──
  @Get('ai/status')
  aiStatus() {
    return this.ai.status();
  }

  @Post('tasks/:id/ai')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  taskAi(@Param('id', ParseIntPipe) id: number, @Body() b: { action?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.forTask(id, u.id, String(b?.action ?? ''));
  }

  /** AI: split pasted notes into task rows for a chat's "Many tasks" preview (nothing is created here) */
  @Post('chat/channels/:uid/ai-split')
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  async aiSplitTasks(@Param('uid') uid: string, @Body() b: { text?: string; tz?: string }, @CurrentUser() u: SessionUser) {
    const { ch } = await this.chat.channel(uid, u.id, 'post');
    // who can get these tasks: the conversation's people (private / DM), or the workspace's people (public channel)
    const ids = ch.kind === 'channel' && !ch.isPrivate
      ? (await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId }, select: { userId: true } })).map((m) => m.userId)
      : ch.members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
    const tz = typeof b?.tz === 'string' && /^[A-Za-z_]+(\/[A-Za-z_+-]+)*$/.test(b.tz) ? b.tz : 'UTC';
    return this.ai.splitTasks(String(b?.text ?? ''), users.map((x) => ({ id: x.id, name: `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim() })), tz);
  }

  @Post('workspaces/:workspaceId/ai/ask')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  async askAi(@Param('workspaceId') ws: string, @Body() b: { question?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.ask(await this.work.resolveWorkspaceId(ws), u.id, String(b?.question ?? ''));
  }

  // ── Share this List ──
  @Get('lists/:id/share')
  listShare(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.links.listShare(id, u.id);
  }

  @Post('lists/:id/share')
  createListShare(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.links.createListShare(id, u.id);
  }

  @Delete('lists/:id/share')
  revokeListShare(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.links.revokeListShare(id, u.id);
  }

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 60 } })
  @Get('public/lists/:token')
  publicList(@Param('token') token: string) {
    return this.links.publicList(token);
  }

  // ── Email to channel ──
  @Get('chat/channels/:uid/email')
  channelEmail(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.links.channelEmail(uid, u.id, false);
  }

  @Post('chat/channels/:uid/email')
  createChannelEmail(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.links.channelEmail(uid, u.id, true);
  }

  @Delete('chat/channels/:uid/email')
  revokeChannelEmail(@Param('uid') uid: string, @CurrentUser() u: SessionUser) {
    return this.links.revokeChannelEmail(uid, u.id);
  }

  /** inbound email service webhook (Mailgun / SendGrid / Postmark) — secret in ?key= or x-inbound-secret */
  @Public()
  @Post('public/inbound-email')
  inboundEmail(@Query('key') key: string, @Headers('x-inbound-secret') header: string, @Body() b: Record<string, any>) {
    return this.links.inbound(header || key, b ?? {});
  }

  // ── whiteboards ──
  @Get('workspaces/:workspaceId/whiteboards')
  async listBoards(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.boards.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/whiteboards')
  async createBoard(@Param('workspaceId') ws: string, @Body() b: { title?: string }, @CurrentUser() u: SessionUser) {
    return this.boards.create(await this.work.resolveWorkspaceId(ws), u.id, b?.title);
  }

  @Get('whiteboards/:id')
  whiteboard(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.boards.get(id, u.id);
  }

  @Patch('whiteboards/:id')
  updateBoard(@Param('id') id: string, @Body() b: { title?: string; data?: unknown }, @CurrentUser() u: SessionUser) {
    return this.boards.update(id, u.id, b ?? {});
  }

  @Delete('whiteboards/:id')
  archiveBoard(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.boards.archive(id, u.id);
  }

  // ── chat calls (voice / video) ──
  @Post('chat/channels/:uid/call')
  startCall(@Param('uid') uid: string, @Body() b: { video?: boolean }, @CurrentUser() u: SessionUser) {
    return this.calls.start(uid, u.id, !!b?.video);
  }

  @Post('chat/calls/join')
  joinCall(@Body() b: { room?: string }, @CurrentUser() u: SessionUser) {
    return this.calls.join(String(b?.room ?? ''), u.id);
  }

  @Post('chat/calls/decline')
  declineCall(@Body() b: { room?: string }, @CurrentUser() u: SessionUser) {
    return this.calls.decline(String(b?.room ?? ''), u.id);
  }

  @Post('chat/calls/leave')
  leaveCall(@Body() b: { room?: string }, @CurrentUser() u: SessionUser) {
    return this.calls.leave(String(b?.room ?? ''), u.id);
  }

  // ── list views: Activity, Collection (files) ──
  @Get('lists/:listUid/activity')
  listActivity(@Param('listUid') listUid: string, @Query('before') before: string, @CurrentUser() u: SessionUser) {
    return this.more.listActivity(listUid, u.id, before);
  }

  @Get('lists/:listUid/files')
  listFiles(@Param('listUid') listUid: string, @CurrentUser() u: SessionUser) {
    return this.more.listFiles(listUid, u.id);
  }

  // ── make owner ──
  @Post('workspaces/:workspaceId/transfer-owner')
  async transferOwner(@Param('workspaceId') ws: string, @Body() b: { userId?: number }, @CurrentUser() u: SessionUser) {
    return this.more.transferOwner(await this.work.resolveWorkspaceId(ws), u.id, Number(b?.userId));
  }

  // ── task: merge, convert, description history, templates, email ──
  @Post('tasks/:taskUid/merge')
  mergeTasks(@Param('taskUid') taskUid: string, @Body() b: { sourceUids?: string[] }, @CurrentUser() u: SessionUser) {
    return this.more.merge(taskUid, Array.isArray(b?.sourceUids) ? b.sourceUids : [], u.id);
  }

  @Post('tasks/:taskUid/convert')
  convertTask(@Param('taskUid') taskUid: string, @Body() b: { to?: string; parentUid?: string }, @CurrentUser() u: SessionUser) {
    return this.more.convert(taskUid, u.id, b ?? {});
  }

  @Get('tasks/:taskUid/description-history')
  descriptionHistory(@Param('taskUid') taskUid: string, @CurrentUser() u: SessionUser) {
    return this.more.descriptionHistory(taskUid, u.id);
  }

  @Post('description-versions/:id/restore')
  restoreDescription(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.more.restoreDescription(id, u.id);
  }

  @Get('workspaces/:workspaceId/task-templates')
  async taskTemplates(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.more.templates(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('tasks/:taskUid/save-template')
  saveTemplate(@Param('taskUid') taskUid: string, @Body() b: { name?: string }, @CurrentUser() u: SessionUser) {
    return this.more.saveTemplate(taskUid, u.id, b?.name);
  }

  @Post('task-templates/:id/apply')
  applyTemplate(@Param('id', ParseIntPipe) id: number, @Body() b: { listUid?: string; name?: string }, @CurrentUser() u: SessionUser) {
    return this.more.applyTemplate(id, u.id, String(b?.listUid ?? ''), b?.name);
  }

  @Delete('task-templates/:id')
  deleteTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.more.deleteTemplate(id, u.id);
  }

  @Post('tasks/:taskUid/email-out')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  emailOut(@Param('taskUid') taskUid: string, @Body() b: { to?: string; subject?: string; body?: string }, @CurrentUser() u: SessionUser) {
    return this.more.emailOut(taskUid, u.id, b ?? {});
  }

  @Get('tasks/:taskUid/email')
  taskEmail(@Param('taskUid') taskUid: string, @CurrentUser() u: SessionUser) {
    return this.more.taskEmail(taskUid, u.id, false);
  }

  @Post('tasks/:taskUid/email')
  createTaskEmail(@Param('taskUid') taskUid: string, @CurrentUser() u: SessionUser) {
    return this.more.taskEmail(taskUid, u.id, true);
  }

  @Delete('tasks/:taskUid/email')
  revokeTaskEmail(@Param('taskUid') taskUid: string, @CurrentUser() u: SessionUser) {
    return this.more.revokeTaskEmail(taskUid, u.id);
  }

  // ── clips (screen recordings) ──
  @Get('workspaces/:workspaceId/clips')
  async clips(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.more.clips(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/clips')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } }))
  async createClip(@Param('workspaceId') ws: string, @UploadedFile() file: Express.Multer.File, @Body() b: { title?: string; durationSec?: string }, @CurrentUser() u: SessionUser) {
    return this.more.createClip(await this.work.resolveWorkspaceId(ws), u.id, file, b ?? {});
  }

  @Get('clips/:clipUid')
  clip(@Param('clipUid') clipUid: string, @CurrentUser() u: SessionUser) {
    return this.more.clip(clipUid, u.id);
  }

  @Patch('clips/:clipUid')
  renameClip(@Param('clipUid') clipUid: string, @Body() b: { title?: string }, @CurrentUser() u: SessionUser) {
    return this.more.renameClip(clipUid, u.id, String(b?.title ?? ''));
  }

  @Delete('clips/:clipUid')
  deleteClip(@Param('clipUid') clipUid: string, @CurrentUser() u: SessionUser) {
    return this.more.deleteClip(clipUid, u.id);
  }

  // ── address search for the Map view ──
  @Get('geocode')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  geocode(@Query('q') q: string) {
    return this.more.geocode(q);
  }
}
