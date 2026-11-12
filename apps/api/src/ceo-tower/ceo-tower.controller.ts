import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { CeoTowerService, type Source } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';

/** CEO Tower: read-only, for workspace owners (checked in the service on every call) */
@Controller('ceo-tower')
export class CeoTowerController {
  constructor(
    private readonly tower: CeoTowerService,
    private readonly ai: CeoAiService,
  ) {}

  // ---------- Executive AI ----------

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

  @Get('access')
  access(@CurrentUser() u: SessionUser) {
    return this.tower.access(u.id);
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
    });
  }

  @Get('overview')
  overview(@Query('source') source: string, @Query('company') company: string, @CurrentUser() u: SessionUser) {
    return this.tower.overview(u.id, (['boards', 'work'].includes(source) ? source : 'all') as Source, /^(boards|work):\d+$/.test(company ?? '') ? company : undefined);
  }
}
