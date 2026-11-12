import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from 'prisma/prisma.service';
import { WorkService } from 'src/work/work.service';
import { WorkChatService } from 'src/work/work-chat.service';
import { CeoTowerService } from './ceo-tower.service';

/**
 * CEO Tower → Executive AI.
 * Claude answers the CEO's questions with read-only tools over the companies they own, and can
 * PROPOSE actions (message people, assign a task). Proposals are stored as pending CeoAiAction
 * rows and only run when the CEO presses Confirm — the model can never act on its own.
 * Conversations are kept on the server and only ever appended to.
 */
type Msg = Anthropic.Beta.BetaMessageParam;
type ToolDef = Anthropic.Beta.BetaTool;

const DAY = 86_400_000;
const MAX_STEPS = 10;
const MODEL = () => process.env.CEO_AI_MODEL || 'claude-opus-5-5';
const EFFORT = () => (['low', 'medium', 'high', 'xhigh', 'max'].includes(process.env.CEO_AI_EFFORT ?? '') ? process.env.CEO_AI_EFFORT : 'medium') as 'low' | 'medium' | 'high';

const SYSTEM = `You are the Executive AI inside EZ Manage's CEO Tower. You work for the CEO (the owner of the companies below) and answer questions about their companies, people and work.

Data you can see (through tools only): every Boards workspace and Work workspace the CEO owns — tasks, statuses, due dates, who is assigned, progress of spaces / folders / lists / boards, teams and reporting lines, and chat ACTIVITY (who messages whom and how much — never message contents).

How to answer:
- Always look things up with tools before answering; never guess names, numbers or dates. If a name matches several people or places, say so and ask which one.
- Reply in the CEO's language and style (they often write Roman Urdu / Hindi mixed with English — answer the same way).
- Be brief and concrete: lead with the answer, then a few bullets with names, counts and dates. Mention overdue work and blockers first.
- "What is X doing" = their tasks in progress and overdue, what they finished this week, and who they have been talking to.
- "Team progress" = the person's direct reports and the teams they are in, each with open / overdue / done.

Actions:
- You cannot send messages or create tasks yourself. When the CEO asks you to message someone or assign work, use propose_message / propose_assign_task. That only prepares the action; the CEO sees a card and must press Confirm.
- After proposing, tell the CEO exactly what is ready and that it will go out only when they confirm. Never claim something was sent.
- For "message everyone" style requests, resolve the exact people with tools first and list them in the proposal.
- Write messages in a professional, friendly tone, in the language the CEO used.`;

const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef => ({
  name, description,
  input_schema: { type: 'object', properties, required, additionalProperties: false } as any,
});

const TOOLS: ToolDef[] = [
  tool('portfolio_overview', 'Every company the CEO owns (Boards and Work) with health, open / overdue / in-progress counts, people, and overall KPIs.', {
    source: { type: 'string', enum: ['all', 'boards', 'work'], description: 'Limit to one product. Default all.' },
  }),
  tool('find_people', 'Find people in the CEO\'s companies by name or email. Returns ids to use with other tools.', {
    query: { type: 'string', description: 'Part of a name or email, e.g. "khan".' },
  }, ['query']),
  tool('person_report', 'What a person is doing: tasks in progress, overdue, due soon, finished in the last days, companies, and who they have been messaging (counts only).', {
    person_id: { type: 'integer' }, days: { type: 'integer', description: 'Look-back window for activity, default 7.' },
  }, ['person_id']),
  tool('team_report', 'A person\'s team: their direct reports and the Work teams they belong to, each member with open / in progress / overdue / done this week.', {
    person_id: { type: 'integer' },
  }, ['person_id']),
  tool('list_tasks', 'Tasks across the CEO\'s companies with filters.', {
    state: { type: 'string', enum: ['open', 'in_progress', 'overdue', 'due_week', 'done_week', 'unassigned', 'all'] },
    person_id: { type: 'integer' }, company_key: { type: 'string', description: 'e.g. "work:12" or "boards:3" from portfolio_overview.' },
    query: { type: 'string', description: 'Words in the task, list or board name.' }, limit: { type: 'integer', description: 'Max tasks to return, default 40.' },
  }),
  tool('find_places', 'Find spaces, folders and lists (Work) and boards (Boards) by name in the CEO\'s companies.', {
    query: { type: 'string' },
  }, ['query']),
  tool('place_progress', 'Progress of a space, folder, list or board: totals, overdue, in progress, per list and per person.', {
    type: { type: 'string', enum: ['space', 'folder', 'list', 'board'] }, id: { type: 'integer' },
  }, ['type', 'id']),
  tool('chat_activity', 'Who has been talking to whom in Work chat (message counts per conversation, no contents), optionally for one person.', {
    person_id: { type: 'integer' }, days: { type: 'integer', description: 'Default 7.' },
  }),
  tool('propose_message', 'Prepare a direct message from the CEO to one or more people. It is NOT sent until the CEO confirms in the UI.', {
    person_ids: { type: 'array', items: { type: 'integer' }, description: 'Recipients (from find_people / reports).' },
    text: { type: 'string', description: 'The message, written as the CEO.' },
  }, ['person_ids', 'text']),
  tool('propose_assign_task', 'Prepare a new Work task assigned to people. It is NOT created until the CEO confirms in the UI.', {
    list_id: { type: 'integer', description: 'A Work list id from find_places.' },
    task_name: { type: 'string' }, assignee_ids: { type: 'array', items: { type: 'integer' } },
    description: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD' },
    priority: { type: 'string', enum: ['URGENT', 'HIGH', 'NORMAL', 'LOW'] },
  }, ['list_id', 'task_name', 'assignee_ids']),
];

@Injectable()
export class CeoAiService {
  private readonly log = new Logger('CeoAi');
  private client: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tower: CeoTowerService,
    private readonly work: WorkService,
    private readonly chat: WorkChatService,
  ) {}

  configured() {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }
  status() {
    return { configured: this.configured(), model: MODEL() };
  }
  private api() {
    if (!this.configured()) throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'Executive AI is not set up yet: add ANTHROPIC_API_KEY to the server settings.' });
    return (this.client ??= new Anthropic());
  }

  // ---------- conversation ----------

  async chatTurn(userId: number, text: string, conversationId?: string) {
    await this.tower.access(userId).then((a) => { if (!a.allowed) throw new ForbiddenException('CEO Tower is for workspace owners.'); });
    const question = (text ?? '').trim();
    if (!question) throw new BadRequestException('Ask something.');
    if (question.length > 4000) throw new BadRequestException('Keep the question under 4,000 characters.');
    const client = this.api();
    const conv = conversationId
      ? await this.prisma.ceoAiConversation.findFirst({ where: { id: conversationId, userId } })
      : await this.prisma.ceoAiConversation.create({ data: { userId, title: question.slice(0, 80) } });
    if (!conv) throw new NotFoundException('Conversation not found.');

    // history is append-only: we add the new turn to what was stored and never rewrite earlier turns
    const history = (conv.messages as unknown as Msg[]) ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const turn: Msg[] = [{ role: 'user', content: [{ type: 'text', text: question }, { type: 'text', text: `(Today is ${today}.)` }] }];
    const used: string[] = [];
    const proposed: string[] = [];
    let reply = '';

    for (let step = 0; step < MAX_STEPS; step++) {
      let res: Anthropic.Beta.BetaMessage;
      try {
        res = await client.beta.messages.create({
          model: MODEL(),
          max_tokens: 16000,
          output_config: { effort: EFFORT() },
          cache_control: { type: 'ephemeral' },
          system: SYSTEM,
          tools: TOOLS,
          messages: [...history, ...turn],
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        } as any) as Anthropic.Beta.BetaMessage;
      } catch (e) {
        this.log.error(`Claude request failed: ${(e as Error).message}`);
        if (e instanceof Anthropic.AuthenticationError) throw new ServiceUnavailableException({ code: 'AI_BAD_KEY', message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY on the server.' });
        if (e instanceof Anthropic.RateLimitError) throw new ServiceUnavailableException({ code: 'AI_BUSY', message: 'Executive AI is busy right now. Try again in a minute.' });
        throw new ServiceUnavailableException({ code: 'AI_ERROR', message: 'Executive AI could not answer right now. Try again.' });
      }
      turn.push({ role: 'assistant', content: res.content as any });

      if (res.stop_reason === 'refusal') { reply = 'I can’t help with that request.'; break; }
      if (res.stop_reason === 'pause_turn') continue;
      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) {
        reply = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (res.stop_reason === 'max_tokens') reply += '\n\n_(answer cut short)_';
        break;
      }
      // run every tool call of this step, then return all results in one user message
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        used.push(call.name);
        try {
          const out = await this.runTool(userId, conv.id, call.name, (call.input ?? {}) as Record<string, any>);
          if (out && typeof out === 'object' && 'actionId' in out) proposed.push((out as any).actionId);
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out).slice(0, 60_000) });
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: (e as any)?.response?.message ?? (e as Error).message ?? 'Tool failed.' });
        }
      }
      turn.push({ role: 'user', content: results });
      if (step === MAX_STEPS - 1) reply = 'I looked through a lot of data but could not finish — try a narrower question.';
    }

    // save only a complete turn (an unanswered tool call would break the next request)
    const last = turn[turn.length - 1];
    if (last.role === 'user') turn.push({ role: 'assistant', content: [{ type: 'text', text: reply || '…' }] });
    await this.prisma.ceoAiConversation.update({ where: { id: conv.id }, data: { messages: [...history, ...turn] as any } });
    const actions = proposed.length ? await this.prisma.ceoAiAction.findMany({ where: { id: { in: proposed } }, orderBy: { createdAt: 'asc' } }) : [];
    return { conversationId: conv.id, reply: reply || '…', used: [...new Set(used)], actions: actions.map(this.shapeAction) };
  }

  /** a conversation of this CEO (or a new empty one) — used by the dev tool route */
  async ensureConversation(userId: number, id?: string) {
    if (id) {
      const c = await this.prisma.ceoAiConversation.findFirst({ where: { id, userId }, select: { id: true } });
      if (!c) throw new NotFoundException('Conversation not found.');
      return c.id;
    }
    return (await this.prisma.ceoAiConversation.create({ data: { userId, title: 'Test' } })).id;
  }

  async conversations(userId: number) {
    return this.prisma.ceoAiConversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, title: true, updatedAt: true } });
  }

  /** the conversation as the CEO saw it: their questions, the answers, and the action cards */
  async conversation(userId: number, id: string) {
    const conv = await this.prisma.ceoAiConversation.findFirst({ where: { id, userId }, include: { actions: { orderBy: { createdAt: 'asc' } } } });
    if (!conv) throw new NotFoundException('Conversation not found.');
    const out: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const m of conv.messages as unknown as Msg[]) {
      const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content as any[]);
      const text = blocks.filter((b) => b.type === 'text' && !/^\(Today is \d{4}-\d{2}-\d{2}\.\)$/.test(b.text)).map((b) => b.text).join('\n').trim();
      if (!text) continue;
      const prev = out[out.length - 1];
      if (m.role === 'assistant' && prev?.role === 'assistant') prev.text = text; // keep the final answer of a turn
      else out.push({ role: m.role as 'user' | 'assistant', text });
    }
    return { id: conv.id, title: conv.title, messages: out, actions: conv.actions.map(this.shapeAction) };
  }

  private shapeAction = (a: { id: string; kind: string; payload: any; status: string; result: any; createdAt: Date; decidedAt: Date | null }) =>
    ({ id: a.id, kind: a.kind, payload: a.payload, status: a.status, result: a.result, createdAt: a.createdAt, decidedAt: a.decidedAt });

  // ---------- tools ----------

  /** exposed for tests (and only reachable from the API when CEO_AI_DEV_TOOLS=1) */
  async runTool(userId: number, conversationId: string, name: string, input: Record<string, any>): Promise<unknown> {
    const own = await this.tower.owned(userId);
    if (!own.boards.length && !own.work.length) throw new ForbiddenException('CEO Tower is for workspace owners.');
    const workIds = own.work.map((w) => w.id);
    const int = (v: unknown) => (Number.isInteger(Number(v)) ? Number(v) : undefined);
    const days = Math.min(Math.max(int(input.days) ?? 7, 1), 90);
    const name2 = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

    switch (name) {
      case 'portfolio_overview': {
        const o = await this.tower.overview(userId, ['boards', 'work'].includes(input.source) ? input.source : 'all');
        return {
          kpis: o.kpis,
          companies: o.companies.map((c) => ({ key: c.key, name: c.name, product: c.source, health: c.health, ...c.stats, people: c.people })),
          most_overdue: o.attention.overdue.slice(0, 10).map((t) => ({ task: t.task.name, company: t.company, where: t.where, due: t.due, people: t.people })),
        };
      }
      case 'find_people': {
        const q = String(input.query ?? '').trim();
        if (q.length < 2) throw new BadRequestException('Give at least 2 letters.');
        const ids = await this.peopleIds(own);
        const users = await this.prisma.user.findMany({
          where: { id: { in: ids }, deletedAt: null, OR: q.split(/\s+/).map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }, { email: { contains: w, mode: 'insensitive' as const } }] })) },
          select: { id: true, firstName: true, lastName: true, email: true }, take: 15,
        });
        return users.map((u) => ({ person_id: u.id, name: name2(u), email: u.email }));
      }
      case 'person_report': {
        const pid = int(input.person_id);
        if (!pid) throw new BadRequestException('person_id is required.');
        const p = await this.tower.person(userId, pid);
        const all = await this.tower.tasks(userId, { person: pid, state: 'all', limit: 1000 });
        const t = all.tasks;
        const since = Date.now() - days * DAY;
        const mini = (x: (typeof t)[number]) => ({ task: x.name, company: x.company.name, where: x.where, status: x.status?.label ?? null, due: x.due, overdue: x.overdue });
        return {
          person: { id: p.user.id, name: name2(p.user), title: p.title, companies: p.memberships.map((m) => `${m.name} (${m.source}, ${m.role})`) },
          counts: { open: t.filter((x) => !x.done).length, in_progress: t.filter((x) => x.active).length, overdue: t.filter((x) => x.overdue).length, done_in_window: t.filter((x) => x.done && x.doneAt && +new Date(x.doneAt) >= since).length },
          in_progress: t.filter((x) => x.active).slice(0, 15).map(mini),
          overdue: t.filter((x) => x.overdue).slice(0, 15).map(mini),
          due_soon: t.filter((x) => !x.done && !x.overdue && x.due && x.due <= new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)).slice(0, 10).map(mini),
          finished_recently: t.filter((x) => x.done && x.doneAt && +new Date(x.doneAt) >= since).slice(0, 15).map(mini),
          talking_with: (await this.chatActivity(workIds, days, pid)).conversations.slice(0, 10),
          window_days: days,
        };
      }
      case 'team_report': {
        const pid = int(input.person_id);
        if (!pid) throw new BadRequestException('person_id is required.');
        await this.tower.person(userId, pid);
        const [reports, teams] = await Promise.all([
          this.prisma.workMember.findMany({ where: { workspaceId: { in: workIds }, managerId: pid }, select: { userId: true } }),
          this.prisma.workTeam.findMany({ where: { workspaceId: { in: workIds }, members: { some: { userId: pid } } }, select: { name: true, members: { select: { userId: true } } } }),
        ]);
        const ids = [...new Set([...reports.map((r) => r.userId), ...teams.flatMap((t) => t.members.map((m) => m.userId))])].filter((i) => i !== pid);
        const rows: { person_id: number; name: string; open: number; in_progress: number; overdue: number; done_this_week: number }[] = [];
        for (const id of ids.slice(0, 25)) {
          const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } });
          if (!u) continue;
          const c = (await this.tower.tasks(userId, { person: id, state: 'all', limit: 1000 })).tasks;
          rows.push({ person_id: id, name: name2(u), open: c.filter((x) => !x.done).length, in_progress: c.filter((x) => x.active).length, overdue: c.filter((x) => x.overdue).length, done_this_week: c.filter((x) => x.done && x.doneAt && +new Date(x.doneAt) >= Date.now() - 7 * DAY).length });
        }
        return { direct_reports: reports.map((r) => r.userId), teams: teams.map((t) => t.name), members: rows };
      }
      case 'list_tasks': {
        const r = await this.tower.tasks(userId, {
          state: ['open', 'in_progress', 'overdue', 'due_week', 'done_week', 'unassigned', 'all'].includes(input.state) ? input.state : 'open',
          person: int(input.person_id), company: /^(boards|work):\d+$/.test(input.company_key ?? '') ? input.company_key : undefined, q: input.query,
          limit: Math.min(int(input.limit) ?? 40, 100),
        });
        return { total: r.total, counts: r.counts, tasks: r.tasks.map((t) => ({ task: t.name, company: t.company.name, product: t.source, where: t.where, status: t.status?.label ?? null, due: t.due, overdue: t.overdue, done: t.done, people: t.assignees.map((a: any) => name2(a)) })) };
      }
      case 'find_places': {
        const q = String(input.query ?? '').trim();
        if (q.length < 2) throw new BadRequestException('Give at least 2 letters.');
        const like = { contains: q, mode: 'insensitive' as const };
        const [spaces, folders, lists, boards] = await Promise.all([
          this.prisma.space.findMany({ where: { workspaceId: { in: workIds }, archivedAt: null, name: like }, select: { id: true, name: true, workspaceId: true }, take: 10 }),
          this.prisma.workFolder.findMany({ where: { archivedAt: null, name: like, space: { workspaceId: { in: workIds }, archivedAt: null } }, select: { id: true, name: true, space: { select: { name: true } } }, take: 10 }),
          this.prisma.workList.findMany({ where: { archivedAt: null, name: like, space: { workspaceId: { in: workIds }, archivedAt: null } }, select: { id: true, name: true, space: { select: { name: true } }, folder: { select: { name: true } } }, take: 15 }),
          this.prisma.board.findMany({ where: { workspaceId: { in: own.boards.map((b) => b.id) }, name: like }, select: { id: true, name: true, workspace: { select: { name: true } } }, take: 10 }),
        ]);
        return [
          ...spaces.map((s) => ({ type: 'space', id: s.id, name: s.name })),
          ...folders.map((f) => ({ type: 'folder', id: f.id, name: f.name, in: f.space.name })),
          ...lists.map((l) => ({ type: 'list', id: l.id, name: l.name, in: [l.space.name, l.folder?.name].filter(Boolean).join(' / ') })),
          ...boards.map((b) => ({ type: 'board', id: b.id, name: b.name, in: b.workspace.name })),
        ];
      }
      case 'place_progress': {
        const id = int(input.id);
        const type = String(input.type);
        if (!id || !['space', 'folder', 'list', 'board'].includes(type)) throw new BadRequestException('Give a type and id from find_places.');
        let match: (p: { type: string; id: number }) => boolean;
        let label = '';
        if (type === 'board') {
          const b = await this.prisma.board.findFirst({ where: { id, workspaceId: { in: own.boards.map((x) => x.id) } }, select: { name: true } });
          if (!b) throw new NotFoundException('Board not found in your companies.');
          label = b.name; match = (p) => p.type === 'board' && p.id === id;
        } else {
          const where = type === 'list' ? { id } : type === 'folder' ? { folderId: id } : { spaceId: id };
          const ls = await this.prisma.workList.findMany({ where: { ...where, archivedAt: null, space: { workspaceId: { in: workIds } } }, select: { id: true, name: true } });
          if (!ls.length) throw new NotFoundException(`That ${type} was not found in your companies (or has no lists).`);
          const set = new Set(ls.map((l) => l.id));
          label = type === 'list' ? ls[0].name : `${ls.length} lists`;
          match = (p) => p.type === 'list' && set.has(p.id);
        }
        const all = (await this.tower.tasks(userId, { state: 'all', limit: 1000 })).tasks.filter((t: any) => match(t.place));
        const by = (key: (t: any) => string[]) => { const m = new Map<string, any[]>(); for (const t of all) for (const k of key(t)) m.set(k, [...(m.get(k) ?? []), t]); return m; };
        const sum = (l: any[]) => ({ total: l.length, done: l.filter((t) => t.done).length, open: l.filter((t) => !t.done).length, in_progress: l.filter((t) => t.active).length, overdue: l.filter((t) => t.overdue).length, progress_pct: l.length ? Math.round((l.filter((t) => t.done).length / l.length) * 100) : 0 });
        return {
          place: label, ...sum(all),
          by_list_or_board: [...by((t) => [t.where]).entries()].map(([k, l]) => ({ name: k, ...sum(l) })),
          by_person: [...by((t) => (t.assignees.length ? t.assignees.map((a: any) => name2(a)) : ['Unassigned'])).entries()].map(([k, l]) => ({ person: k, ...sum(l) })),
          overdue_tasks: all.filter((t: any) => t.overdue).slice(0, 10).map((t: any) => ({ task: t.name, due: t.due, people: t.assignees.map((a: any) => name2(a)) })),
        };
      }
      case 'chat_activity':
        return this.chatActivity(workIds, days, int(input.person_id));
      case 'propose_message': {
        const ids = [...new Set((Array.isArray(input.person_ids) ? input.person_ids : []).map(Number).filter(Number.isInteger))].filter((i) => i !== userId);
        const text = String(input.text ?? '').trim();
        if (!ids.length || !text) throw new BadRequestException('Give recipients and the message text.');
        if (ids.length > 50) throw new BadRequestException('Up to 50 people per message.');
        if (text.length > 4000) throw new BadRequestException('Keep the message under 4,000 characters.');
        const people: { id: number; name: string; reachable: boolean }[] = [];
        for (const id of ids) {
          const p = await this.tower.person(userId, id).catch(() => null);
          if (!p) throw new BadRequestException(`Person ${id} is not in your companies.`);
          people.push({ id, name: name2(p.user), reachable: p.reach.length > 0 });
        }
        const a = await this.prisma.ceoAiAction.create({ data: { conversationId, userId, kind: 'message', payload: { people, text } } });
        return { actionId: a.id, status: 'proposed — waiting for the CEO to confirm', recipients: people.map((p) => p.name), not_reachable: people.filter((p) => !p.reachable).map((p) => p.name) };
      }
      case 'propose_assign_task': {
        const listId = int(input.list_id);
        const taskName = String(input.task_name ?? '').trim();
        const assignees = [...new Set((Array.isArray(input.assignee_ids) ? input.assignee_ids : []).map(Number).filter(Number.isInteger))];
        if (!listId || !taskName || !assignees.length) throw new BadRequestException('Give a list, a task name and at least one person.');
        const list = await this.prisma.workList.findFirst({ where: { id: listId, archivedAt: null, space: { workspaceId: { in: workIds }, archivedAt: null } }, select: { id: true, name: true, space: { select: { workspaceId: true, name: true } } } });
        if (!list) throw new BadRequestException('That list is not in your Work companies.');
        const members = await this.prisma.workMember.findMany({ where: { workspaceId: list.space.workspaceId, userId: { in: assignees } }, select: { userId: true, user: { select: { firstName: true, lastName: true } } } });
        if (members.length !== assignees.length) throw new BadRequestException('Everyone assigned must be a member of that Work company.');
        const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date ?? '') ? input.due_date : null;
        const priority = ['URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(input.priority) ? input.priority : null;
        const a = await this.prisma.ceoAiAction.create({
          data: { conversationId, userId, kind: 'assign_task', payload: { listId, list: `${list.space.name} / ${list.name}`, name: taskName.slice(0, 500), description: String(input.description ?? '').slice(0, 5000) || null, assignees: members.map((m) => ({ id: m.userId, name: name2(m.user) })), due, priority } },
        });
        return { actionId: a.id, status: 'proposed — waiting for the CEO to confirm', task: taskName, list: `${list.space.name} / ${list.name}`, assignees: members.map((m) => name2(m.user)) };
      }
      default:
        throw new BadRequestException(`Unknown tool ${name}.`);
    }
  }

  /** everyone in the CEO's companies */
  private async peopleIds(own: Awaited<ReturnType<CeoTowerService['owned']>>) {
    const [b, w] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: own.boards.map((x) => x.id) }, deletedAt: null }, select: { userId: true } }),
      this.prisma.workMember.findMany({ where: { workspaceId: { in: own.work.map((x) => x.id) } }, select: { userId: true } }),
    ]);
    return [...new Set([...b, ...w].map((x) => x.userId))];
  }

  /** message counts per conversation (never contents) in the CEO's Work companies */
  private async chatActivity(workIds: number[], days: number, personId?: number) {
    if (!workIds.length) return { window_days: days, conversations: [] };
    const since = new Date(Date.now() - days * DAY);
    const counts = await this.prisma.workChatMessage.groupBy({
      by: ['channelId'], _count: { _all: true },
      where: { deletedAt: null, kind: { not: 'system' }, createdAt: { gte: since }, channel: { workspaceId: { in: workIds }, archivedAt: null, ...(personId ? { members: { some: { userId: personId } } } : {}) } },
    });
    const chans = await this.prisma.workChannel.findMany({ where: { id: { in: counts.map((c) => c.channelId) } }, select: { id: true, kind: true, name: true, lastMessageAt: true, members: { select: { user: { select: { id: true, firstName: true, lastName: true } } } } } });
    const byId = new Map(chans.map((c) => [c.id, c]));
    const sent = personId ? await this.prisma.workChatMessage.groupBy({ by: ['channelId'], _count: { _all: true }, where: { userId: personId, deletedAt: null, createdAt: { gte: since }, channelId: { in: counts.map((c) => c.channelId) } } }) : [];
    const sentBy = new Map(sent.map((s) => [s.channelId, s._count._all]));
    return {
      window_days: days,
      conversations: counts.map((c) => {
        const ch = byId.get(c.channelId)!;
        const names = ch.members.map((m) => `${m.user.firstName} ${m.user.lastName}`.trim());
        return {
          conversation: ch.kind === 'channel' ? `#${ch.name}` : `DM: ${names.join(' & ')}`,
          kind: ch.kind, messages: c._count._all, ...(personId ? { sent_by_person: sentBy.get(c.channelId) ?? 0 } : {}),
          last_message_at: ch.lastMessageAt,
        };
      }).sort((a, b) => b.messages - a.messages).slice(0, 25),
    };
  }

  // ---------- confirming / cancelling a proposed action ----------

  async decide(userId: number, actionId: string, confirm: boolean) {
    const a = await this.prisma.ceoAiAction.findFirst({ where: { id: actionId, userId } });
    if (!a) throw new NotFoundException('Action not found.');
    // claim it so a double click runs it once
    const claimed = await this.prisma.ceoAiAction.updateMany({ where: { id: a.id, status: 'pending' }, data: { status: confirm ? 'running' : 'cancelled', decidedAt: new Date() } });
    if (!claimed.count) throw new BadRequestException('This action was already handled.');
    if (!confirm) return this.shapeAction((await this.prisma.ceoAiAction.findUniqueOrThrow({ where: { id: a.id } })) as any);
    const p = a.payload as any;
    let status: 'done' | 'failed' = 'done';
    let result: any;
    try {
      if (a.kind === 'message') {
        const sent: string[] = [], failed: { name: string; reason: string }[] = [];
        for (const person of p.people as { id: number; name: string }[]) {
          try {
            const info = await this.tower.person(userId, person.id);
            if (!info.reach.length) throw new Error('not in any of your Work companies');
            const ws = await this.prisma.workWorkspace.findUniqueOrThrow({ where: { uid: info.reach[0].uid }, select: { id: true } });
            const dm = await this.chat.dm(ws.id, userId, [person.id]);
            await this.chat.send(dm.uid, userId, { content: p.text });
            sent.push(person.name);
          } catch (e) {
            failed.push({ name: person.name, reason: (e as any)?.response?.message ?? (e as Error).message });
          }
        }
        result = { sent, failed };
        if (!sent.length) status = 'failed';
      } else if (a.kind === 'assign_task') {
        const t: any = await this.work.createTask(p.listId, userId, { name: p.name, assigneeIds: p.assignees.map((x: any) => x.id), ...(p.description ? { description: p.description } : {}), ...(p.due ? { dueDate: new Date(`${p.due}T17:00:00Z`).toISOString() } : {}), ...(p.priority ? { priority: p.priority } : {}) } as any);
        result = { taskUid: t.uid, name: t.name };
      } else throw new Error('Unknown action.');
    } catch (e) {
      status = 'failed';
      result = { error: (e as any)?.response?.message ?? (e as Error).message };
    }
    const done = await this.prisma.ceoAiAction.update({ where: { id: a.id }, data: { status, result } });
    return this.shapeAction(done as any);
  }
}
