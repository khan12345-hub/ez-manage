import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CeoTowerService, type Source } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';
import { CeoCommsService } from './ceo-comms.service';
import { CeoTaskService } from './ceo-task.service';
import { CeoDigestService } from './ceo-digest.service';

/** CEO Tower: read-only, for Administrators who own a company (checked in the service on every call) */
@Controller('ceo-tower')
export class CeoTowerController {
  constructor(
    private readonly tower: CeoTowerService,
    private readonly ai: CeoAiService,
    private readonly comms: CeoCommsService,
    private readonly task: CeoTaskService,
    private readonly digest: CeoDigestService,
  ) {}

  // ---------- Meetings & Email ----------

  @Get('audiences')
  audiences(@CurrentUser() u: SessionUser) {
    return this.comms.audiences(u.id);
  }

  @Get('meetings')
  meetings(@Query('when') when: string, @CurrentUser() u: SessionUser) {
    return this.comms.listMeetings(u.id, when === 'past' ? 'past' : 'upcoming');
  }

  /** meetings linked to a CRM contact / company (for the CRM record page) */
  @Get('meetings/crm')
  crmMeetings(@Query('workspaceId') ws: string, @Query('contactId') contactId: string, @Query('companyId') companyId: string, @CurrentUser() u: SessionUser) {
    return this.comms.crmMeetings(u.id, { workspaceId: Number(ws), contactId: contactId ? Number(contactId) : undefined, companyId: companyId ? Number(companyId) : undefined });
  }

  @Get('meetings/google-status')
  meetingsGoogle(@CurrentUser() u: SessionUser) {
    return this.comms.googleStatus(u.id);
  }

  @Post('meetings')
  createMeeting(@Body() b: { title: string; description?: string; meetingLink?: string; scheduledAt: string; attendeeIds?: number[]; attendeeEmails?: { email: string; name?: string }[]; crmWorkspaceId?: number; crmContactId?: number; crmCompanyId?: number; addGoogleMeet?: boolean }, @CurrentUser() u: SessionUser) {
    return this.comms.createMeeting(u.id, b);
  }

  @Patch('meetings/:id')
  updateMeeting(@Param('id', ParseIntPipe) id: number, @Body() b: { title?: string; description?: string | null; meetingLink?: string | null; scheduledAt?: string; attendeeIds?: number[]; attendeeEmails?: { email: string; name?: string }[] }, @CurrentUser() u: SessionUser) {
    return this.comms.updateMeeting(u.id, id, b);
  }

  @Post('meetings/:id/cancel')
  cancelMeeting(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.comms.cancelMeeting(u.id, id);
  }

  @Get('email/history')
  emailHistory(@CurrentUser() u: SessionUser) {
    return this.comms.emailHistory(u.id);
  }

  @Post('email')
  email(@Body() b: { recipientIds: number[]; subject: string; body: string }, @CurrentUser() u: SessionUser) {
    return this.comms.email(u.id, b);
  }

  /** open (or create) a direct-message chat with one person — no company picker needed */
  @Post('dm')
  openDm(@Body() b: { personId: number; via?: string }, @CurrentUser() u: SessionUser) {
    return this.comms.openDm(u.id, Number(b.personId), b.via);
  }

  // ---------- Executive AI ----------

  /** the CEO's brief: last 24 hours across all companies (AI-written when an engine is set up) */
  @Get('ai/brief')
  aiBrief(@CurrentUser() u: SessionUser, @Query('refresh') refresh?: string) {
    return this.ai.brief(u.id, refresh === '1');
  }

  @Get('ai/status')
  async aiStatus(@CurrentUser() u: SessionUser) {
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('Executive Hub is only for Administrators.');
    return this.ai.status();
  }

  @Post('ai/chat')
  aiChat(@Body() b: { message?: string; conversationId?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.chatTurn(u.id, String(b.message ?? ''), b.conversationId ? String(b.conversationId) : undefined);
  }

  @Get('ai/conversations')
  async aiConversations(@CurrentUser() u: SessionUser) {
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('Executive Hub is only for Administrators.');
    return this.ai.conversations(u.id);
  }

  @Get('ai/conversations/:id')
  aiConversation(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.ai.conversation(u.id, id);
  }

  @Post('ai/actions/:id/confirm')
  aiConfirm(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.ai.decide(u.id, id, true);
  }

  @Post('ai/actions/:id/cancel')
  aiCancel(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.ai.decide(u.id, id, false);
  }

  /** testing only: run one AI tool directly, without the model (off unless CEO_AI_DEV_TOOLS=1) */
  @Post('ai/dev/tool')
  async aiDevTool(@Body() b: { name?: string; input?: Record<string, any>; conversationId?: string }, @CurrentUser() u: SessionUser) {
    if (process.env.CEO_AI_DEV_TOOLS !== '1' || process.env.NODE_ENV === 'production') throw new NotFoundException();
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('Executive Hub is only for Administrators.');
    const conv = await this.ai.ensureConversation(u.id, b.conversationId ? String(b.conversationId) : undefined);
    return { conversationId: conv, result: await this.ai.runTool(u.id, conv, String(b.name ?? ''), b.input ?? {}) };
  }

  /** message one person as the CEO — Work chat, or Boards chat for people only in Boards */
  @Post('message')
  message(@CurrentUser() u: SessionUser, @Body() b: { personId: number; text: string; via?: string }) {
    return this.comms.message(u.id, Number(b?.personId), String(b?.text ?? ''), b?.via ? String(b.via) : undefined);
  }

  /** morning brief + red-company alert settings */
  @Get('settings')
  settings(@CurrentUser() u: SessionUser) {
    return this.digest.settings(u.id);
  }

  @Put('settings')
  saveSettings(@CurrentUser() u: SessionUser, @Body() b: { briefOn?: boolean; briefEmail?: boolean; briefHour?: number; timezone?: string; alertsOn?: boolean }) {
    return this.digest.saveSettings(u.id, b ?? {});
  }

  /** send the morning brief now (to try it) */
  @Post('brief/send')
  briefNow(@CurrentUser() u: SessionUser) {
    return this.digest.briefNow(u.id);
  }

  @Get('access')
  access(@CurrentUser() u: SessionUser) {
    return this.tower.access(u.id);
  }

  /** owners: who they've shared CEO Tower with */
  @Get('access/shared')
  accessGrants(@CurrentUser() u: SessionUser) {
    return this.tower.accessGrants(u.id);
  }

  @Post('access/shared')
  grantAccess(@CurrentUser() u: SessionUser, @Body() body: { userId: number }) {
    return this.tower.grantAccess(u.id, Number(body?.userId));
  }

  @Delete('access/shared/:userId')
  revokeAccess(@CurrentUser() u: SessionUser, @Param('userId', ParseIntPipe) userId: number) {
    return this.tower.revokeAccess(u.id, userId);
  }

  @Get('team')
  team(@Query('source') source: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.team(u.id, (['boards', 'work'].includes(source) ? source : 'all') as Source, /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }

  @Get('structure')
  structure(@Query('product') product: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.structure(u.id, product === 'boards' ? 'boards' : 'work', /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }

  @Get('people/:id/report')
  personReport(@Param('id', ParseIntPipe) id: number, @Query('days') days: string, @CurrentUser() u: SessionUser) {
    return this.tower.personReport(u.id, id, Math.min(Math.max(Number(days) || 7, 1), 90));
  }

  @Get('people/:id')
  person(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.tower.person(u.id, id);
  }

  @Get('for-you')
  forYou(@CurrentUser() u: SessionUser) {
    return this.tower.forYou(u.id);
  }

  @Post('for-you/read')
  forYouRead(@Body() b: { source?: string; id?: string | number }, @CurrentUser() u: SessionUser) {
    return this.tower.markForYouRead(u.id, b.source === 'boards' ? 'boards' : 'work', String(b.id ?? '').slice(0, 64));
  }

  /** one task (Boards or Work) with its thread — the CEO Tower task popup */
  @Get('task/:source/:id')
  taskDetail(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    return this.task.get(u.id, source, id);
  }

  @Post('task/:source/:id/comment')
  taskComment(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @Body() b: { text: string; parentId?: number; attachmentIds?: number[] }, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    const attachmentIds = Array.isArray(b?.attachmentIds) ? b.attachmentIds.map(Number).filter(Number.isInteger).slice(0, 10) : undefined;
    return this.task.comment(u.id, source, id, String(b?.text ?? ''), b?.parentId ? Number(b.parentId) : undefined, { attachmentIds });
  }

  /** Boards: an instruction with files / a voice note (Work uploads through its own attachments route first) */
  @Post('task/boards/:id/comment-files')
  @UseInterceptors(FilesInterceptor('files', 5, { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }))
  taskCommentFiles(@Param('id', ParseIntPipe) id: number, @UploadedFiles() files: Express.Multer.File[], @Body() b: { text?: string; parentId?: string }, @CurrentUser() u: SessionUser) {
    return this.task.comment(u.id, 'boards', id, String(b?.text ?? ''), b?.parentId ? Number(b.parentId) : undefined, { files: files ?? [] });
  }

  /** due date / people / priority */
  @Patch('task/:source/:id')
  taskUpdate(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @Body() b: { due?: string | null; assigneeIds?: number[]; priority?: string | null }, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    return this.task.update(u.id, source, id, {
      ...(b && 'due' in b ? { due: b.due ?? null } : {}),
      ...(Array.isArray(b?.assigneeIds) ? { assigneeIds: b.assigneeIds } : {}),
      ...(b && 'priority' in b ? { priority: b.priority ?? null } : {}),
    });
  }

  /** change status; with no statusId: "Mark completed" (the task's done status) */
  @Post('task/:source/:id/status')
  taskStatus(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @Body() b: { statusId?: number }, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    return this.task.setStatus(u.id, source, id, b?.statusId ? Number(b.statusId) : undefined);
  }

  /** "Reports to" for Boards people (kept by CEO Tower) */
  @Put('report-lines/boards/:workspaceId/:userId')
  setReportLine(@Param('workspaceId', ParseIntPipe) ws: number, @Param('userId', ParseIntPipe) person: number, @Body() b: { managerId: number | null }, @CurrentUser() u: SessionUser) {
    return this.tower.setBoardsReportLine(u.id, ws, person, b?.managerId == null ? null : Number(b.managerId));
  }

  /** weekly created vs completed, daily open / overdue */
  @Get('trends')
  trends(@Query() q: Record<string, string>, @CurrentUser() u: SessionUser) {
    return this.tower.trends(u.id, (['boards', 'work'].includes(q.source) ? q.source : 'all') as Source, /^(boards|work):\d+$/.test(q.company ?? '') ? q.company : undefined);
  }

  /** Management: managers and the people under them */
  @Get('management')
  management(@Query() q: Record<string, string>, @CurrentUser() u: SessionUser) {
    return this.tower.management(u.id, (['boards', 'work'].includes(q.source) ? q.source : 'all') as Source, /^(boards|work):\d+$/.test(q.company ?? '') ? q.company : undefined);
  }

  /** a company's members (and boards / pending invites) for "Manage people" */
  @Get('companies/:key/people')
  companyPeople(@Param('key') key: string, @CurrentUser() u: SessionUser) {
    return this.tower.companyPeople(u.id, key);
  }

  @Get('tasks')
  tasks(@Query() q: Record<string, string>, @CurrentUser() u: SessionUser) {
    return this.tower.tasks(u.id, {
      source: (['boards', 'work'].includes(q.source) ? q.source : 'all') as Source,
      company: /^(boards|work):\d+$/.test(q.company ?? '') ? q.company : undefined,
      person: /^\d+$/.test(q.person ?? '') ? Number(q.person) : undefined,
      state: ['open', 'in_progress', 'overdue', 'due_week', 'done_week', 'unassigned', 'all'].includes(q.state) ? q.state : 'open',
      q: (q.q ?? '').slice(0, 100),
      limit: /^\d+$/.test(q.limit ?? '') ? Number(q.limit) : undefined,
      place: ['space', 'folder', 'list', 'board'].includes(q.placeType) && /^\d+$/.test(q.placeId ?? '') ? { type: q.placeType, id: Number(q.placeId) } : undefined,
      // "CEO tasks": only tasks this person created (gave out)
      by: q.by === 'me' ? u.id : undefined,
    });
  }

  @Get('assigned')
  assigned(@Query() q: Record<string, string>, @CurrentUser() u: SessionUser) {
    return this.tower.assignedByMe(u.id, {
      person: /^\d+$/.test(q.person ?? '') ? Number(q.person) : undefined,
      company: /^(work|boards):\d+$/.test(q.company ?? '') ? q.company : undefined,
      state: ['open', 'done', 'overdue', 'all'].includes(q.state) ? q.state : 'all',
      source: q.source === 'work' || q.source === 'boards' ? q.source : undefined,
    });
  }

  @Get('channels')
  channels(@CurrentUser() u: SessionUser) {
    return this.tower.execChannels(u.id);
  }

  @Get('overview')
  overview(@Query('source') source: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.overview(u.id, (['boards', 'work'].includes(source) ? source : 'all') as Source, /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }
}
