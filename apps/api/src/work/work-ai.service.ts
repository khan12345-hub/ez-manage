import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkService } from './work.service';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = () => process.env.CEO_AI_GROQ_MODEL || 'openai/gpt-oss-120b';
const CLAUDE_MODEL = () => process.env.CEO_AI_MODEL || 'claude-opus-5-5';
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (h: string | null | undefined) => (h ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Work AI (like ClickUp Brain): write a task description, summarize a comment thread, suggest
 * subtasks, and answer questions about the workspace — only from what this person can see.
 * Claude when ANTHROPIC_API_KEY is set, otherwise the free Groq engine. Suggestions only: the
 * person applies them (nothing is changed by the AI itself).
 */
@Injectable()
export class WorkAiService {
  private readonly log = new Logger('WorkAi');
  private client: Anthropic | null = null;
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService, private readonly work: WorkService) {}

  status() {
    const provider = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? 'claude' : process.env.GROQ_API_KEY ? 'groq' : null;
    return { configured: !!provider, provider };
  }

  private async complete(system: string, user: string, maxTokens = 1200): Promise<string> {
    const { provider } = this.status();
    if (!provider) throw new ServiceUnavailableException('Work AI is not set up on this server (GROQ_API_KEY or ANTHROPIC_API_KEY).');
    if (provider === 'claude') {
      const res = await (this.client ??= new Anthropic()).messages.create({ model: CLAUDE_MODEL(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
      return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
    }
    const body = JSON.stringify({ model: GROQ_MODEL(), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.3 });
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(GROQ_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body, signal: AbortSignal.timeout(90_000) }).catch(() => null);
      if (!res) break;
      if (res.status === 429) {
        const secs = Number(res.headers.get('retry-after')) || Number(/try again in ([\d.]+)s/i.exec(await res.text().catch(() => ''))?.[1]);
        if (!secs || secs > 25) throw new ServiceUnavailableException('The free AI limit is used up for now. Try again in a little while.');
        await new Promise((r) => setTimeout(r, (secs + 0.5) * 1000));
        continue;
      }
      if (!res.ok) { this.log.warn(`Groq ${res.status}`); break; }
      const data: any = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? '').trim();
    }
    throw new ServiceUnavailableException('Work AI could not answer right now. Try again.');
  }

  /**
   * Split free text (meeting notes, a brain dump) into tasks for a chat's "Many tasks" preview.
   * Only suggests: the person reviews the rows and creates them. Assignees are limited to `people`.
   */
  async splitTasks(text: string, people: { id: number; name: string }[], tz = 'UTC') {
    try { new Date().toLocaleDateString('en-CA', { timeZone: tz }); } catch { tz = 'UTC'; } // unknown zone
    const notes = text.trim().slice(0, 12000);
    if (notes.length < 3) throw new BadRequestException('Paste some notes first.');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
    const weekday = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
    const system = [
      'You turn meeting notes or a list of to-dos into separate, actionable tasks.',
      'Reply with JSON only: {"tasks":[{"name":string,"description":string|null,"assigneeIds":number[],"dueDate":"YYYY-MM-DD"|null,"priority":"URGENT"|"HIGH"|"NORMAL"|"LOW"}]}',
      'Rules: one task per distinct action; name is short and starts with a verb (max 90 chars); keep the language of the notes;',
      'description only for useful extra detail from the notes, else null;',
      'assigneeIds only from the people list, matched by name or first name mentioned as the owner (empty if nobody is named);',
      `dueDate only when the notes give a time ("by Friday", "tomorrow", "25 Nov"); today is ${weekday} ${today};`,
      'priority NORMAL unless the notes say urgent / ASAP / important (HIGH) or critical / blocker (URGENT) or low / whenever (LOW);',
      'at most 50 tasks; skip chit-chat, decisions without an action, and duplicates.',
    ].join(' ');
    const user = `People:\n${people.map((p) => `${p.id}: ${p.name}`).join('\n') || '(none)'}\n\nNotes:\n"""\n${notes}\n"""`;
    const raw = await this.complete(system, user, 3000);
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    let parsed: any;
    try { parsed = JSON.parse(json); } catch { throw new ServiceUnavailableException('The AI answer could not be read. Try again.'); }
    const ok = new Set(people.map((p) => p.id));
    const pri = new Set(['URGENT', 'HIGH', 'NORMAL', 'LOW']);
    const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : []).slice(0, 50).map((t: any) => ({
      name: String(t?.name ?? '').trim().slice(0, 200),
      description: t?.description ? String(t.description).trim().slice(0, 2000) : null,
      assigneeIds: (Array.isArray(t?.assigneeIds) ? t.assigneeIds : []).map(Number).filter((id: number) => ok.has(id)),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(t?.dueDate ?? '')) ? String(t.dueDate) : null,
      priority: pri.has(String(t?.priority)) ? String(t.priority) : 'NORMAL',
    })).filter((t: { name: string }) => t.name.length > 0);
    if (!tasks.length) throw new BadRequestException('No tasks found in these notes.');
    return { tasks };
  }

  /** describe | summarize | subtasks for one task (needs view access; the person applies the result) */
  async forTask(taskId: number, userId: number, action: string) {
    await this.access.requireTask(taskId, userId, 'view');
    const t = await this.prisma.workTask.findUnique({
      where: { id: taskId },
      select: { name: true, description: true, list: { select: { name: true } }, subtasks: { where: { archivedAt: null }, select: { name: true } } },
    });
    if (!t) throw new BadRequestException('Task not found.');
    if (action === 'describe') {
      const text = await this.complete(
        'You write clear task descriptions for a project management tool. Given a task title (and any notes), write: one short paragraph saying what the task is and why, then a "Steps" list of 3-6 concrete steps, then "Done when" with 1-3 acceptance criteria. Plain, practical English. Use only lines starting with "- " for list items. No headings with #, no bold markers.',
        `Task: ${t.name}\nList: ${t.list.name}\nExisting notes: ${plain(t.description).slice(0, 2000) || '(none)'}`,
      );
      return { action, html: this.toHtml(text), text };
    }
    if (action === 'summarize') {
      const comments = await this.prisma.workComment.findMany({ where: { taskId, deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 80, select: { content: true, createdAt: true, user: { select: { firstName: true, lastName: true } } } });
      if (!comments.length) return { action, text: 'There are no comments on this task yet.', html: '<p>There are no comments on this task yet.</p>' };
      const thread = comments.map((c) => `${c.user.firstName} ${c.user.lastName} (${c.createdAt.toISOString().slice(0, 10)}): ${plain(c.content).slice(0, 600)}`).join('\n');
      const text = await this.complete(
        'Summarize a task\'s comment thread for a busy manager: 3-5 bullet points of what was decided or reported (who said it), then "Next steps:" with the open actions and who owns them. Only use what is in the thread. Each bullet starts with "- ".',
        `Task: ${t.name}\n\nThread:\n${thread}`,
      );
      return { action, text, html: this.toHtml(text) };
    }
    if (action === 'subtasks') {
      const text = await this.complete(
        'Break a task into 3-7 concrete subtasks. Reply with only the subtask names, one per line, each starting with "- ". Short, action-first names (max 80 characters). Do not repeat existing subtasks.',
        `Task: ${t.name}\nList: ${t.list.name}\nDetails: ${plain(t.description).slice(0, 1500) || '(none)'}\nExisting subtasks: ${t.subtasks.map((s) => s.name).join('; ') || '(none)'}`,
        600,
      );
      const names = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-*•\d.)]+\s+/.test(l)).map((l) => l.replace(/^[-*•\d.)]+\s+/, '').replace(/\*\*/g, '').trim().slice(0, 120)).filter(Boolean).slice(0, 7);
      return { action, subtasks: names };
    }
    throw new BadRequestException('Unknown AI action.');
  }

  /** ask about the workspace: answered only from tasks this person can see */
  async ask(workspaceId: number, userId: number, question: string) {
    const q = (question ?? '').trim();
    if (!q) throw new BadRequestException('Ask something.');
    if (q.length > 1000) throw new BadRequestException('Keep the question under 1,000 characters.');
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const tasks: any[] = await this.work.allTasks(workspaceId, userId);
    const today = new Date().toISOString().slice(0, 10);
    const facts = tasks.slice(0, 400).map((t) => ({
      task: t.name, list: t.list?.name, status: t.status?.name ?? null, done: !!t.completedAt,
      due: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null, overdue: !t.completedAt && !!t.dueDate && new Date(t.dueDate).toISOString().slice(0, 10) < today,
      people: (t.assignees ?? []).map((a: any) => `${a.firstName} ${a.lastName}`), priority: t.priority ?? null,
    }));
    const text = await this.complete(
      `You answer questions about a team's work using ONLY the JSON list of tasks given (today is ${today}). Be concise and specific: name tasks, people and dates. If the answer is not in the data, say so. Use short paragraphs or "- " bullets.`,
      `Question: ${q}\n\nTasks (${facts.length}${tasks.length > 400 ? ` of ${tasks.length}` : ''}):\n${JSON.stringify(facts)}`,
      1500,
    );
    return { answer: text, tasksSeen: facts.length };
  }

  /** "- " lines → a <ul>, other lines → paragraphs; everything escaped */
  private toHtml(text: string) {
    const out: string[] = [];
    let list: string[] = [];
    const flush = () => { if (list.length) { out.push(`<ul>${list.map((i) => `<li><p>${esc(i)}</p></li>`).join('')}</ul>`); list = []; } };
    for (const raw of text.split(/\r?\n/)) {
      const l = raw.trim().replace(/\*\*/g, '');
      if (!l) { flush(); continue; }
      const m = /^[-*•]\s+(.*)$/.exec(l) || /^\d+[.)]\s+(.*)$/.exec(l);
      if (m) list.push(m[1]!);
      else { flush(); out.push(`<p>${/:$/.test(l) && l.length < 40 ? `<strong>${esc(l)}</strong>` : esc(l)}</p>`); }
    }
    flush();
    return out.join('');
  }
}
