import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CeoTowerService, type Source } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';
import { CeoCommsService } from './ceo-comms.service';
import { CeoTaskService } from './ceo-task.service';

/** CEO Tower: read-only, for workspace owners (checked in the service on every call) */
@Controller('ceo-tower')
export class CeoTowerController {
  constructor(
    private readonly tower: CeoTowerService,
    private readonly ai: CeoAiService,
    private readonly comms: CeoCommsService,
    private readonly task: CeoTaskService,
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

  @Post('meetings')
  createMeeting(@Body() b: { title: string; description?: string; meetingLink?: string; scheduledAt: string; attendeeIds: number[] }, @CurrentUser() u: SessionUser) {
    return this.comms.createMeeting(u.id, b);
  }

  @Patch('meetings/:id')
  updateMeeting(@Param('id', ParseIntPipe) id: number, @Body() b: { title?: string; description?: string | null; meetingLink?: string | null; scheduledAt?: string; attendeeIds?: number[] }, @CurrentUser() u: SessionUser) {
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

  // ---------- Executive AI ----------

  /** the CEO's brief: last 24 hours across all companies (AI-written when an engine is set up) */
  @Get('ai/brief')
  aiBrief(@CurrentUser() u: SessionUser, @Query('refresh') refresh?: string) {
    return this.ai.brief(u.id, refresh === '1');
  }

  @Get('ai/status')
  async aiStatus(@CurrentUser() u: SessionUser) {
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('CEO Tower is for workspace owners.');
    return this.ai.status();
  }

  @Post('ai/chat')
  aiChat(@Body() b: { message?: string; conversationId?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.chatTurn(u.id, String(b.message ?? ''), b.conversationId ? String(b.conversationId) : undefined);
  }

  @Get('ai/conversations')
  async aiConversations(@CurrentUser() u: SessionUser) {
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('CEO Tower is for workspace owners.');
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
    if (!(await this.tower.access(u.id)).allowed) throw new ForbiddenException('CEO Tower is for workspace owners.');
    const conv = await this.ai.ensureConversation(u.id, b.conversationId ? String(b.conversationId) : undefined);
    return { conversationId: conv, result: await this.ai.runTool(u.id, conv, String(b.name ?? ''), b.input ?? {}) };
  }

  /** message one person as the CEO — Work chat, or Boards chat for people only in Boards */
  @Post('message')
  message(@CurrentUser() u: SessionUser, @Body() b: { personId: number; text: string; via?: string }) {
    return this.comms.message(u.id, Number(b?.personId), String(b?.text ?? ''), b?.via ? String(b.via) : undefined);
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
  taskComment(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @Body() b: { text: string; parentId?: number }, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    return this.task.comment(u.id, source, id, String(b?.text ?? ''), b?.parentId ? Number(b.parentId) : undefined);
  }

  /** change status; with no statusId: "Mark completed" (the task's done status) */
  @Post('task/:source/:id/status')
  taskStatus(@Param('source') source: string, @Param('id', ParseIntPipe) id: number, @Body() b: { statusId?: number }, @CurrentUser() u: SessionUser) {
    if (source !== 'boards' && source !== 'work') throw new NotFoundException();
    return this.task.setStatus(u.id, source, id, b?.statusId ? Number(b.statusId) : undefined);
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

  @Get('overview')
  overview(@Query('source') source: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.overview(u.id, (['boards', 'work'].includes(source) ? source : 'all') as Source, /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }
}
