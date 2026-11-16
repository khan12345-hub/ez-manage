import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkChatService } from './work-chat.service';
import { WorkService } from './work.service';

const token = () => randomBytes(18).toString('base64url');

/**
 * "Share this List" (a public, read-only link that can be turned off) and "Email to channel"
 * (a channel's own address; an inbound-email service posts what it receives into the channel).
 */
@Injectable()
export class WorkLinksService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService, private readonly chat: WorkChatService, private readonly work: WorkService) {}

  // ---------- Share this List ----------

  private async listFor(listId: number, userId: number, level: 'view' | 'edit') {
    const l = await this.prisma.workList.findUnique({ where: { id: listId }, select: { id: true, uid: true, name: true, spaceId: true, space: { select: { workspaceId: true } } } });
    if (!l) throw new NotFoundException('List not found.');
    await this.access.requireSpace(l.spaceId, userId, level);
    return l;
  }

  async listShare(listId: number, userId: number) {
    await this.listFor(listId, userId, 'view');
    const link = await this.prisma.workLink.findFirst({ where: { kind: 'LIST_SHARE', targetId: listId, revokedAt: null } });
    return { token: link?.token ?? null };
  }

  async createListShare(listId: number, userId: number) {
    const l = await this.listFor(listId, userId, 'edit');
    const existing = await this.prisma.workLink.findFirst({ where: { kind: 'LIST_SHARE', targetId: listId, revokedAt: null } });
    if (existing) return { token: existing.token };
    const link = await this.prisma.workLink.create({ data: { token: token(), kind: 'LIST_SHARE', workspaceId: l.space.workspaceId, targetId: listId, createdById: userId } });
    return { token: link.token };
  }

  async revokeListShare(listId: number, userId: number) {
    await this.listFor(listId, userId, 'edit');
    await this.prisma.workLink.updateMany({ where: { kind: 'LIST_SHARE', targetId: listId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** public, read-only: the list's open and recent tasks (names, status, people, due, priority) */
  async publicList(tok: string) {
    const link = await this.prisma.workLink.findUnique({ where: { token: tok } });
    if (!link || link.kind !== 'LIST_SHARE' || link.revokedAt) throw new NotFoundException('This link is not active.');
    const list = await this.prisma.workList.findFirst({ where: { id: link.targetId, archivedAt: null }, select: { id: true, name: true, space: { select: { name: true, workspace: { select: { name: true } } } } } });
    if (!list) throw new NotFoundException('This link is not active.');
    const tasks = await this.prisma.workTask.findMany({
      where: { listId: list.id, archivedAt: null, parentId: null },
      orderBy: [{ completedAt: 'asc' }, { order: 'asc' }], take: 500,
      select: { name: true, dueDate: true, priority: true, completedAt: true, status: { select: { name: true, color: true } }, assignees: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
    return {
      list: list.name, space: list.space.name, company: list.space.workspace.name,
      tasks: tasks.map((t) => ({ name: t.name, status: t.status, due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null, priority: t.priority, done: !!t.completedAt, people: t.assignees.map((a) => `${a.user.firstName} ${a.user.lastName.slice(0, 1)}.`) })),
    };
  }

  // ---------- Email to channel ----------

  private domain() { return process.env.INBOUND_EMAIL_DOMAIN?.trim() || null; }

  private async channelFor(uid: string, userId: number) {
    const ch = await this.prisma.workChannel.findUnique({ where: { uid }, select: { id: true, workspaceId: true, name: true, kind: true } });
    if (!ch) throw new NotFoundException('Channel not found.');
    if (ch.kind !== 'channel') throw new BadRequestException('Only channels get an email address.');
    await this.chat.channel(uid, userId, 'post');
    return ch;
  }

  async channelEmail(uid: string, userId: number, create: boolean) {
    const ch = await this.channelFor(uid, userId);
    let link = await this.prisma.workLink.findFirst({ where: { kind: 'CHANNEL_EMAIL', targetId: ch.id, revokedAt: null } });
    if (!link && create) link = await this.prisma.workLink.create({ data: { token: token().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20), kind: 'CHANNEL_EMAIL', workspaceId: ch.workspaceId, targetId: ch.id, createdById: userId } });
    const d = this.domain();
    return { address: link && d ? `ch-${link.token}@${d}` : null, token: link?.token ?? null, configured: !!d };
  }

  async revokeChannelEmail(uid: string, userId: number) {
    const ch = await this.channelFor(uid, userId);
    await this.prisma.workLink.updateMany({ where: { kind: 'CHANNEL_EMAIL', targetId: ch.id, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /**
   * Inbound email webhook (Mailgun / SendGrid / Postmark style fields). Protected by
   * INBOUND_EMAIL_SECRET (?key= or x-inbound-secret). The message is posted in the channel
   * as the person who created the address, marked as an email.
   */
  async inbound(secret: string | undefined, body: Record<string, any>) {
    const want = process.env.INBOUND_EMAIL_SECRET;
    if (!want) throw new ForbiddenException('Inbound email is not set up on this server.');
    const a = Buffer.from(String(secret ?? '')), b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    const to = String(body.recipient ?? body.To ?? body.to ?? '').toLowerCase();
    const m = /\b(ch|tk)-([a-z0-9]{8,40})@/.exec(to);
    if (!m) throw new BadRequestException('No channel or task address in "to".');
    const link = await this.prisma.workLink.findUnique({ where: { token: m[2] } });
    const kind = m[1] === 'tk' ? 'TASK_EMAIL' : 'CHANNEL_EMAIL';
    if (!link || link.kind !== kind || link.revokedAt) throw new NotFoundException('Unknown address.');
    const from = String(body.sender ?? body.From ?? body.from ?? 'someone').slice(0, 200);
    const subject = String(body.subject ?? body.Subject ?? '(no subject)').slice(0, 300);
    const text = String(body['stripped-text'] ?? body['body-plain'] ?? body.TextBody ?? body.text ?? '').trim().slice(0, 8000);
    if (kind === 'TASK_EMAIL') {
      // email to task: posted as a comment by the person who made the address
      const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = `<p>📧 <strong>Email from ${esc(from)}</strong> — ${esc(subject)}</p>${(text || '(empty message)').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}`;
      await this.work.createComment(link.targetId, link.createdById, { content: html } as any);
      return { ok: true };
    }
    const ch = await this.prisma.workChannel.findUnique({ where: { id: link.targetId }, select: { uid: true } });
    if (!ch) throw new NotFoundException('Unknown address.');
    const content = `📧 **Email from ${from}** — ${subject}\n\n${text || '(empty message)'}`;
    await this.chat.send(ch.uid, link.createdById, { content } as any);
    return { ok: true };
  }
}
