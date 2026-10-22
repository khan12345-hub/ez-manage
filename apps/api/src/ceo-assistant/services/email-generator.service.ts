import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { EmployeeTaskGroup } from './task-analyzer.service';

export interface GeneratedDraft {
  recipientId: number;
  subject: string;
  body: string;
  taskSnapshot: object;
}

@Injectable()
export class EmailGeneratorService {
  private readonly logger = new Logger(EmailGeneratorService.name);
  private readonly groq: Groq | null;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.groq = apiKey ? new Groq({ apiKey }) : null;
    if (!this.groq) {
      this.logger.warn('GROQ_API_KEY not set — email generation will use fallback template');
    }
  }

  async generateDraft(
    employee: EmployeeTaskGroup,
    opts: { tone: string; categories: string[]; senderName: string },
  ): Promise<GeneratedDraft> {
    const taskLines: string[] = [];

    if (opts.categories.includes('overdue') && employee.overdue.length > 0) {
      taskLines.push(`OVERDUE TASKS (${employee.overdue.length}):`);
      employee.overdue.slice(0, 8).forEach((t) => {
        taskLines.push(`  - "${t.taskName}" (board: ${t.boardName}, overdue by ${t.daysOverdue ?? '?'} days)`);
      });
    }

    if (opts.categories.includes('due_soon') && employee.dueSoon.length > 0) {
      taskLines.push(`\nDUE SOON (${employee.dueSoon.length}):`);
      employee.dueSoon.slice(0, 8).forEach((t) => {
        const due = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A';
        taskLines.push(`  - "${t.taskName}" (board: ${t.boardName}, due: ${due})`);
      });
    }

    if (opts.categories.includes('inactive') && employee.inactive.length > 0) {
      taskLines.push(`\nINACTIVE TASKS (${employee.inactive.length}):`);
      employee.inactive.slice(0, 8).forEach((t) => {
        taskLines.push(`  - "${t.taskName}" (board: ${t.boardName})`);
      });
    }

    if (taskLines.length === 0) {
      taskLines.push('No specific task concerns at this time.');
    }

    const taskSnapshot = {
      overdue: employee.overdue.map((t) => ({ id: t.taskId, name: t.taskName, daysOverdue: t.daysOverdue })),
      dueSoon: employee.dueSoon.map((t) => ({ id: t.taskId, name: t.taskName, dueDate: t.dueDate })),
      inactive: employee.inactive.map((t) => ({ id: t.taskId, name: t.taskName })),
    };

    if (!this.groq) {
      return this.fallbackDraft(employee, taskLines, taskSnapshot);
    }

    try {
      const prompt = this.buildPrompt(employee, taskLines, opts);
      const completion = await this.groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      return this.parseDraftFromResponse(raw, employee, taskSnapshot);
    } catch (err) {
      this.logger.error(`Groq call failed for employee ${employee.user.id}`, err);
      return this.fallbackDraft(employee, taskLines, taskSnapshot);
    }
  }

  private buildPrompt(
    employee: EmployeeTaskGroup,
    taskLines: string[],
    opts: { tone: string; senderName: string },
  ): string {
    const toneDesc = opts.tone === 'friendly' ? 'warm and encouraging' : opts.tone === 'firm' ? 'firm and direct' : 'professional and respectful';

    return `You are ${opts.senderName}, a manager writing a task follow-up email to ${employee.user.firstName} ${employee.user.lastName} (${employee.user.email}).

Write a ${toneDesc} email about their pending tasks. Be concise (3-5 sentences max in the body). Do not use bullet points in the email body.

Task summary for ${employee.user.firstName}:
${taskLines.join('\n')}

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{"subject": "...", "body": "..."}

The body should be plain text only (no HTML), signed with "${opts.senderName}".`;
  }

  private parseDraftFromResponse(
    raw: string,
    employee: EmployeeTaskGroup,
    taskSnapshot: object,
  ): GeneratedDraft {
    const jsonMatch = raw.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string };
        if (parsed.subject && parsed.body) {
          return { recipientId: employee.user.id, subject: parsed.subject, body: parsed.body, taskSnapshot };
        }
      } catch {
        // fall through to fallback
      }
    }

    // LLM returned free text — use it as body
    return {
      recipientId: employee.user.id,
      subject: `Task Follow-up for ${employee.user.firstName} ${employee.user.lastName}`,
      body: raw.trim(),
      taskSnapshot,
    };
  }

  private fallbackDraft(
    employee: EmployeeTaskGroup,
    taskLines: string[],
    taskSnapshot: object,
  ): GeneratedDraft {
    const name = `${employee.user.firstName} ${employee.user.lastName}`;
    const subject = `Task Update Required – ${name}`;
    const body = `Hi ${employee.user.firstName},\n\nThis is a reminder to review your pending tasks:\n\n${taskLines.join('\n')}\n\nPlease update the status at your earliest convenience.\n\nRegards`;
    return { recipientId: employee.user.id, subject, body, taskSnapshot };
  }
}
