import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from 'prisma/prisma.service';
import { WorkService } from 'src/work/work.service';
import { WorkChatService } from 'src/work/work-chat.service';
import { CeoTowerService } from './ceo-tower.service';
import { CeoCommsService } from './ceo-comms.service';

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
/** free fallback when there is no Claude key: Groq (OpenAI-compatible API, free tier with daily limits) */
const GROQ_MODEL = () => process.env.CEO_AI_GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
type Provider = 'claude' | 'groq';
export type CeoBrief = { generatedAt: string; by: 'claude' | 'groq' | 'summary'; bullets: string[] };
/** one model step, in the stored (Claude) message shape whichever engine answered */
type Step = { content: any[]; stop_reason: string | null };
const EFFORT = () => (['low', 'medium', 'high', 'xhigh', 'max'].includes(process.env.CEO_AI_EFFORT ?? '') ? process.env.CEO_AI_EFFORT : 'medium') as 'low' | 'medium' | 'high';

const SYSTEM = `You are the Executive AI inside EZ Manage's Executive Hub. You work for the CEO (the owner of the companies below) and answer questions about their companies, people and work.

Data you can see (through tools only): every Boards workspace and Work workspace the CEO owns — tasks, statuses, due dates, who is assigned, progress of spaces / folders / lists / boards, teams and reporting lines, and chat ACTIVITY (who messages whom and how much — never message contents).

How to answer:
- Always look things up with tools before answering; never guess names, numbers or dates. If a name matches several people or places, say so and ask which one.
- Reply in the CEO's language and style (they often write Roman Urdu / Hindi mixed with English — answer the same way).
- Be brief and concrete: lead with the answer, then a few bullets with names, counts and dates. Mention overdue work and blockers first.
- "What is X doing" = their tasks in progress and overdue, what they finished this week, and who they have been talking to.
- "Team progress" = the person's direct reports and the teams they are in, each with open / overdue / done.

Actions:
- You cannot send messages, emails, invites or create tasks yourself. When the CEO asks you to message someone, email them, set up a meeting or assign work, use propose_message / propose_email / propose_meeting / propose_assign_task.
- "Management" and team names: resolve them with list_audiences. Meetings need a date AND time; if the CEO did not give one, ask. Times are in the CEO's local time; send scheduled_at as ISO 8601 with the timezone offset if you know it.
- Chat message vs email: "message" means a chat DM; "email" / "mail" means an email. That only prepares the action; the CEO sees a card and must press Confirm.
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
  tool('list_audiences', 'Groups the CEO can address: management (owners, admins and managers), Work teams with members, and everyone per company. Returns person ids.', {}),
  tool('propose_email', 'Prepare an email from the CEO to people ({first_name} is replaced per person). NOT sent until the CEO confirms.', {
    person_ids: { type: 'array', items: { type: 'integer' } }, subject: { type: 'string' }, body: { type: 'string', description: 'Plain text, written as the CEO.' },
  }, ['person_ids', 'subject', 'body']),
  tool('propose_meeting', 'Prepare a meeting with invitations (attendees are notified, and reminded 24 h, 1 h and 15 min before). NOT created until the CEO confirms.', {
    title: { type: 'string' }, scheduled_at: { type: 'string', description: 'ISO 8601 date-time, e.g. 2026-11-14T15:00:00+05:00' },
    attendee_ids: { type: 'array', items: { type: 'integer' } }, description: { type: 'string', description: 'Agenda (optional).' }, meeting_link: { type: 'string', description: 'Video call link (optional).' },
  }, ['title', 'scheduled_at', 'attendee_ids']),
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
    private readonly comms: CeoCommsService,
  ) {}

  /** Claude when its key is set; otherwise the free Groq engine; otherwise none */
  provider(): Provider | null {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'claude';
    if (process.env.GROQ_API_KEY) return 'groq';
    return null;
  }
  configured() {
    return this.provider() !== null;
  }
  status() {
    const provider = this.provider();
    return { configured: !!provider, provider, model: provider === 'groq' ? GROQ_MODEL() : MODEL() };
  }
  private requireProvider(): Provider {
    const p = this.provider();
    if (!p) throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'Executive AI is not set up yet: add ANTHROPIC_API_KEY (or GROQ_API_KEY for the free engine) to the server settings.' });
    return p;
  }

  /** one step with Claude */
  private async stepClaude(messages: Msg[]): Promise<Step> {
    const client = (this.client ??= new Anthropic());
    try {
      const res = (await client.beta.messages.create({
        model: MODEL(),
        max_tokens: 16000,
        output_config: { effort: EFFORT() },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM,
        tools: TOOLS,
        messages,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      } as any)) as Anthropic.Beta.BetaMessage;
      return { content: res.content as any[], stop_reason: res.stop_reason };
    } catch (e) {
      this.log.error(`Claude request failed: ${(e as Error).message}`);
      if (e instanceof Anthropic.AuthenticationError) throw new ServiceUnavailableException({ code: 'AI_BAD_KEY', message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY on the server.' });
      if (e instanceof Anthropic.RateLimitError) throw new ServiceUnavailableException({ code: 'AI_BUSY', message: 'Executive AI is busy right now. Try again in a minute.' });
      throw new ServiceUnavailableException({ code: 'AI_ERROR', message: 'Executive AI could not answer right now. Try again.' });
    }
  }

  /** POST to Groq; the free tier has a per-minute token limit, so short "try again in Ns" waits are retried */
  private async groqPost(payload: Record<string, unknown>): Promise<Response> {
    const body = JSON.stringify(payload);
    let res: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
          body,
          signal: AbortSignal.timeout(120_000),
        });
      } catch (e) {
        this.log.error(`Groq request failed: ${(e as Error).message}`);
        throw new ServiceUnavailableException({ code: 'AI_ERROR', message: 'Executive AI could not answer right now. Try again.' });
      }
      if (res.status !== 429) break;
      const text = await res.clone().text().catch(() => '');
      const secs = Number(res.headers.get('retry-after')) || Number(/try again in ([\d.]+)s/i.exec(text)?.[1]);
      if (!secs || secs > 25) break; // a long wait means the daily limit: tell the CEO instead of hanging
      await new Promise((r) => setTimeout(r, (secs + 0.5) * 1000));
    }
    return res!;
  }

  /** a single plain answer (no tools) from whichever engine is set up */
  private async complete(system: string, user: string): Promise<string> {
    const provider = this.requireProvider();
    if (provider === 'claude') {
      const client = (this.client ??= new Anthropic());
      const res = await client.messages.create({ model: MODEL(), max_tokens: 1500, system, messages: [{ role: 'user', content: user }] });
      return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    }
    const res = await this.groqPost({ model: GROQ_MODEL(), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1500, temperature: 0.3 });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data: any = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? '');
  }

  // ---------- the CEO's daily brief ----------

  private readonly briefs = new Map<number, { at: number; data: CeoBrief }>();

  /**
   * "What happened in the last 24 hours" across the CEO's companies, written by the AI from facts only
   * (finished work, what slipped, who is behind). Without an AI engine — or if it fails — a plain summary
   * of the same facts is returned, so the panel always works. Cached 20 minutes per person.
   */
  async brief(userId: number, refresh = false): Promise<CeoBrief> {
    const access = await this.tower.access(userId);
    if (!access.allowed) throw new ForbiddenException('Executive Hub is for company owners and the people they share it with.');
    const hit = this.briefs.get(userId);
    if (!refresh && hit && Date.now() - hit.at < 20 * 60_000) return hit.data;

    const o = await this.tower.overview(userId, 'all');
    const dayAgo = Date.now() - DAY;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    const facts = {
      today,
      finished_last_24h: o.updates.filter((u) => u.at && +new Date(u.at) >= dayAgo).map((u) => ({ task: u.task.name, by: u.people.filter((x): x is string => !!x), company: u.company, where: u.where })),
      finished_last_7_days: o.updates.length,
      open_tasks: o.kpis.open,
      in_progress: o.kpis.inProgress,
      overdue_total: o.kpis.overdue,
      slipped_since_yesterday: o.attention.overdue.filter((t) => t.due && t.due >= yesterday).map((t) => ({ task: t.task.name, people: t.people, company: t.company })),
      most_overdue: o.attention.overdue.slice(0, 6).map((t) => ({ task: t.task.name, due: t.due, people: t.people, company: t.company })),
      people_behind: o.people.filter((p) => p.stats.overdue > 0).slice(0, 6).map((p) => ({ name: `${p.user.firstName} ${p.user.lastName}`.trim(), overdue: p.stats.overdue, open: p.stats.open, in_progress: p.stats.inProgress })),
      companies_needing_attention: o.attention.companies.map((c) => ({ name: c.name, product: c.source, overdue: c.overdue })),
      unassigned_open: o.kpis.unassigned,
    };

    let bullets = this.plainBrief(facts);
    let by: CeoBrief['by'] = 'summary';
    if (this.provider()) {
      try {
        const text = await this.complete(
          'You write a CEO\'s morning brief from JSON facts about their companies. Write 4 to 6 bullets, one line each, most important first: what got finished in the last 24 hours (who, which company), what slipped, who is falling behind, and what needs a decision. Use names and exact numbers from the facts. Never invent anything that is not in the facts. Plain English. Each bullet starts with "- ". No heading, intro or closing line.',
          JSON.stringify(facts),
        );
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, '').replace(/\*\*/g, ''));
        if (lines.length) { bullets = lines.slice(0, 7); by = this.provider()!; }
      } catch (e) {
        this.log.warn(`brief: AI unavailable, using the plain summary (${(e as Error).message})`);
      }
    }
    const data: CeoBrief = { generatedAt: new Date().toISOString(), by, bullets };
    this.briefs.set(userId, { at: Date.now(), data });
    return data;
  }

  /** the same facts as plain sentences (no AI) */
  private plainBrief(f: { finished_last_24h: { task: string; by: string[] }[]; overdue_total: number; slipped_since_yesterday: unknown[]; people_behind: { name: string; overdue: number }[]; companies_needing_attention: { name: string; overdue: number }[]; unassigned_open: number; in_progress: number }) {
    const out: string[] = [];
    out.push(f.finished_last_24h.length ? `${f.finished_last_24h.length} task${f.finished_last_24h.length === 1 ? '' : 's'} finished in the last 24 hours: ${f.finished_last_24h.slice(0, 3).map((t) => `${t.task}${t.by.length ? ` (${t.by.join(', ')})` : ''}`).join('; ')}.` : 'Nothing was finished in the last 24 hours.');
    if (f.slipped_since_yesterday.length) out.push(`${f.slipped_since_yesterday.length} task${f.slipped_since_yesterday.length === 1 ? '' : 's'} went overdue since yesterday.`);
    out.push(`${f.overdue_total} task${f.overdue_total === 1 ? ' is' : 's are'} overdue in total; ${f.in_progress} in progress.`);
    if (f.people_behind.length) out.push(`Most behind: ${f.people_behind.slice(0, 3).map((p) => `${p.name} (${p.overdue} overdue)`).join(', ')}.`);
    if (f.companies_needing_attention.length) out.push(`Needs attention: ${f.companies_needing_attention.map((c) => `${c.name} (${c.overdue} overdue)`).join(', ')}.`);
    if (f.unassigned_open) out.push(`${f.unassigned_open} open task${f.unassigned_open === 1 ? ' has' : 's have'} nobody on ${f.unassigned_open === 1 ? 'it' : 'them'}.`);
    return out;
  }

  /** one step with the free Groq engine: translate the stored conversation to its chat format and back */
  private async stepGroq(messages: Msg[]): Promise<Step> {
    const chat: any[] = [{ role: 'system', content: SYSTEM }];
    for (const m of messages) {
      const blocks: any[] = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content as any[]);
      if (m.role === 'user') {
        for (const r of blocks.filter((b) => b.type === 'tool_result')) {
          chat.push({ role: 'tool', tool_call_id: r.tool_use_id, content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content) });
        }
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        if (text) chat.push({ role: 'user', content: text });
      } else {
        const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        const calls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
        chat.push({ role: 'assistant', content: text || (calls.length ? null : '…'), ...(calls.length ? { tool_calls: calls } : {}) });
      }
    }
    const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    const res = await this.groqPost({ model: GROQ_MODEL(), messages: chat, tools, tool_choice: 'auto', max_tokens: 4000, temperature: 0.2 });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.log.error(`Groq ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 401) throw new ServiceUnavailableException({ code: 'AI_BAD_KEY', message: 'The Groq API key was rejected. Check GROQ_API_KEY on the server.' });
      if (res.status === 429) throw new ServiceUnavailableException({ code: 'AI_BUSY', message: 'The free AI limit is used up for now. Try again in a little while.' });
      throw new ServiceUnavailableException({ code: 'AI_ERROR', message: 'Executive AI could not answer right now. Try again.' });
    }
    const data: any = await res.json();
    const choice = data?.choices?.[0];
    const msg = choice?.message ?? {};
    const content: any[] = [];
    if (msg.content) content.push({ type: 'text', text: String(msg.content) });
    for (const c of msg.tool_calls ?? []) {
      let input: Record<string, any> = {};
      try { input = c.function?.arguments ? JSON.parse(c.function.arguments) : {}; } catch { input = {}; }
      content.push({ type: 'tool_use', id: c.id, name: c.function?.name, input });
    }
    const stop = choice?.finish_reason === 'tool_calls' || (msg.tool_calls?.length ?? 0) > 0 ? 'tool_use' : choice?.finish_reason === 'length' ? 'max_tokens' : 'end_turn';
    return { content: content.length ? content : [{ type: 'text', text: '' }], stop_reason: stop };
  }

  // ---------- conversation ----------

  async chatTurn(userId: number, text: string, conversationId?: string) {
    await this.tower.access(userId).then((a) => { if (!a.allowed) throw new ForbiddenException('Executive Hub is only for Administrators.'); });
    const question = (text ?? '').trim();
    if (!question) throw new BadRequestException('Ask something.');
    if (question.length > 4000) throw new BadRequestException('Keep the question under 4,000 characters.');
    const provider = this.requireProvider();
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
      const res = provider === 'claude' ? await this.stepClaude([...history, ...turn]) : await this.stepGroq([...history, ...turn]);
      turn.push({ role: 'assistant', content: res.content as any });

      if (res.stop_reason === 'refusal') { reply = 'I can’t help with that request.'; break; }
      if (res.stop_reason === 'pause_turn') continue;
      const calls = res.content.filter((b: any): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) {
        reply = res.content.filter((b: any): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b: any) => b.text).join('\n').trim();
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
          // the free engine has a small per-minute budget: keep each lookup short there
          results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out).slice(0, provider === 'groq' ? 12_000 : 60_000) });
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
    if (!own.boards.length && !own.work.length) throw new ForbiddenException('Executive Hub is only for Administrators.');
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
        const r = await this.tower.personReport(userId, pid, days);
        const mini = (x: any) => ({ task: x.name, company: x.company.name, where: x.where, status: x.status?.label ?? null, due: x.due, overdue: x.overdue });
        return {
          person: { id: r.user.id, name: name2(r.user), title: r.title, companies: r.memberships.map((m) => `${m.name} (${m.source}, ${m.role})`), teams: r.teams, direct_reports: r.directReports.length },
          counts: r.counts, in_progress: r.inProgress.slice(0, 15).map(mini), overdue: r.overdue.slice(0, 15).map(mini), due_soon: r.dueSoon.slice(0, 10).map(mini),
          finished_recently: r.finished.slice(0, 15).map(mini),
          talking_with: r.talkingWith.slice(0, 10).map(({ conversation, kind, messages, sent_by_person, last_message_at }) => ({ conversation, kind, messages, sent_by_person, last_message_at })),
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
        const ids = new Set([...reports.map((r) => r.userId), ...teams.flatMap((t) => t.members.map((m) => m.userId))].filter((i) => i !== pid));
        // one pass over all tasks for everyone (not one query per person)
        const people = (await this.tower.team(userId)).filter((p) => ids.has(p.user.id));
        return {
          direct_reports: [...new Set(reports.map((r) => r.userId))], teams: teams.map((t) => t.name),
          members: people.map((p) => ({ person_id: p.user.id, name: name2(p.user), title: p.title, open: p.stats.open, in_progress: p.stats.inProgress, overdue: p.stats.overdue, done_this_week: p.stats.doneWeek, progress_pct: p.stats.progress })),
        };
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
      case 'chat_activity': {
        const r = await this.tower.chatActivity(workIds, days, int(input.person_id));
        return { window_days: r.window_days, conversations: r.conversations.map(({ conversation, kind, messages, sent_by_person, last_message_at }) => ({ conversation, kind, messages, sent_by_person, last_message_at })) };
      }
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
          people.push({ id, name: name2(p.user), reachable: p.reach.length + p.boardsReach.length > 0 });
        }
        const a = await this.prisma.ceoAiAction.create({ data: { conversationId, userId, kind: 'message', payload: { people, text } } });
        return { actionId: a.id, status: 'proposed — waiting for the CEO to confirm', recipients: people.map((p) => p.name), not_reachable: people.filter((p) => !p.reachable).map((p) => p.name) };
      }
      case 'list_audiences': {
        const a = await this.comms.audiences(userId);
        const ids = [...new Set([...a.management, ...a.teams.flatMap((t) => t.people), ...a.companies.flatMap((c) => c.people)])];
        const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
        const nm = new Map(users.map((u) => [u.id, name2(u)]));
        const named = (l: number[]) => l.map((i) => ({ person_id: i, name: nm.get(i) ?? String(i) }));
        return { management: named(a.management), teams: a.teams.map((t) => ({ team: t.name, company: t.company, people: named(t.people) })), companies: a.companies.map((c) => ({ company: c.name, product: c.source, people: c.people.length })) };
      }
      case 'propose_email': {
        const ids = [...new Set((Array.isArray(input.person_ids) ? input.person_ids : []).map(Number).filter(Number.isInteger))].filter((i) => i !== userId);
        const subject = String(input.subject ?? '').trim(), body = String(input.body ?? '').trim();
        if (!ids.length || !subject || !body) throw new BadRequestException('Give recipients, a subject and the email text.');
        const people: { id: number; name: string }[] = [];
        for (const id of ids.slice(0, 200)) {
          const p = await this.tower.person(userId, id).catch(() => null);
          if (!p) throw new BadRequestException(`Person ${id} is not in your companies.`);
          people.push({ id, name: name2(p.user) });
        }
        const a = await this.prisma.ceoAiAction.create({ data: { conversationId, userId, kind: 'email', payload: { people, subject: subject.slice(0, 200), body: body.slice(0, 20000) } } });
        return { actionId: a.id, status: 'proposed — waiting for the CEO to confirm', to: people.map((p) => p.name), subject };
      }
      case 'propose_meeting': {
        const ids = [...new Set((Array.isArray(input.attendee_ids) ? input.attendee_ids : []).map(Number).filter(Number.isInteger))].filter((i) => i !== userId);
        const title = String(input.title ?? '').trim();
        const at = new Date(String(input.scheduled_at ?? ''));
        if (!title || !ids.length) throw new BadRequestException('Give a title and at least one attendee.');
        if (isNaN(+at) || +at < Date.now()) throw new BadRequestException('Give a future date and time for the meeting.');
        const link = String(input.meeting_link ?? '').trim();
        if (link && !/^https?:\/\//i.test(link)) throw new BadRequestException('The meeting link must be a web link.');
        const people: { id: number; name: string }[] = [];
        for (const id of ids.slice(0, 200)) {
          const p = await this.tower.person(userId, id).catch(() => null);
          if (!p) throw new BadRequestException(`Person ${id} is not in your companies.`);
          people.push({ id, name: name2(p.user) });
        }
        const a = await this.prisma.ceoAiAction.create({ data: { conversationId, userId, kind: 'meeting', payload: { title: title.slice(0, 255), scheduledAt: at.toISOString(), people, description: String(input.description ?? '').slice(0, 5000) || null, meetingLink: link || null } } });
        return { actionId: a.id, status: 'proposed — waiting for the CEO to confirm', title, when: at.toISOString(), attendees: people.map((p) => p.name) };
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
            // Work chat when you share a Work company, otherwise their Boards chat
            await this.comms.message(userId, person.id, p.text);
            sent.push(person.name);
          } catch (e) {
            failed.push({ name: person.name, reason: (e as any)?.response?.message ?? (e as Error).message });
          }
        }
        result = { sent, failed };
        if (!sent.length) status = 'failed';
      } else if (a.kind === 'email') {
        const r = await this.comms.email(userId, { recipientIds: p.people.map((x: any) => x.id), subject: p.subject, body: p.body });
        result = { sent: r.results.filter((x) => x.status === 'sent').map((x) => x.name), failed: r.results.filter((x) => x.status !== 'sent').map((x) => ({ name: x.name, reason: x.error ?? x.status })) };
        if (!r.sent) status = 'failed';
      } else if (a.kind === 'meeting') {
        const m: any = await this.comms.createMeeting(userId, { title: p.title, scheduledAt: p.scheduledAt, attendeeIds: p.people.map((x: any) => x.id), description: p.description ?? undefined, meetingLink: p.meetingLink ?? undefined });
        result = { meetingId: m.id, title: m.title, scheduledAt: m.scheduledAt };
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
