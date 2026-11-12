import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CeoMeetingService } from 'src/ceo-assistant/services/ceo-meeting.service';
import { CeoTowerService } from './ceo-tower.service';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * CEO Tower → Meetings and Email. Everyone invited or emailed must be in the CEO's companies.
 * Meetings reuse CeoMeetingService (invites + reminders 24h / 1h / 15m before, in Boards and Work).
 * Emails go out through the app's mail service and are recorded in CEO email history.
 */
@Injectable()
export class CeoCommsService {
  private readonly log = new Logger('CeoComms');
  constructor(
    private readonly prisma: PrismaService,
    private readonly tower: CeoTowerService,
    private readonly meetings: CeoMeetingService,
    private readonly mail: MailService,
  ) {}

  /** every person in the CEO's companies */
  private async reachable(userId: number) {
    const own = await this.tower.owned(userId);
    if (!own.boards.length && !own.work.length) throw new BadRequestException('CEO Tower is for workspace owners.');
    const [b, w] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: own.boards.map((x) => x.id) }, deletedAt: null }, select: { userId: true, role: true, workspaceId: true } }),
      this.prisma.workMember.findMany({ where: { workspaceId: { in: own.work.map((x) => x.id) } }, select: { userId: true, role: true, workspaceId: true, managerId: true } }),
    ]);
    return { own, b, w, ids: new Set([...b, ...w].map((m) => m.userId)) };
  }

  private async checkPeople(userId: number, ids: number[]) {
    const clean = [...new Set(ids.map(Number).filter(Number.isInteger))];
    if (!clean.length) throw new BadRequestException('Pick at least one person.');
    if (clean.length > 200) throw new BadRequestException('Up to 200 people at a time.');
    const { ids: ok } = await this.reachable(userId);
    const outside = clean.filter((i) => !ok.has(i));
    if (outside.length) throw new BadRequestException('Everyone must be in your companies.');
    return clean;
  }

  /** quick picks for "who": management, Work teams, whole companies */
  async audiences(userId: number) {
    const { own, b, w } = await this.reachable(userId);
    const managers = new Set(w.map((m) => m.managerId).filter((v): v is number => !!v));
    const management = [...new Set([...b.filter((m) => ['OWNER', 'ADMIN'].includes(m.role)), ...w.filter((m) => ['OWNER', 'ADMIN'].includes(m.role))].map((m) => m.userId).concat([...managers]))].filter((i) => i !== userId);
    const teams = await this.prisma.workTeam.findMany({ where: { workspaceId: { in: own.work.map((x) => x.id) } }, orderBy: { name: 'asc' }, select: { id: true, name: true, workspaceId: true, members: { select: { userId: true } } } });
    const wsName = new Map(own.work.map((x) => [x.id, x.name]));
    return {
      management,
      teams: teams.map((t) => ({ id: t.id, name: t.name, company: wsName.get(t.workspaceId) ?? '', people: t.members.map((m) => m.userId).filter((i) => i !== userId) })),
      companies: [
        ...own.boards.map((x) => ({ key: `boards:${x.id}`, name: x.name, source: 'boards', people: [...new Set(b.filter((m) => m.workspaceId === x.id).map((m) => m.userId))].filter((i) => i !== userId) })),
        ...own.work.map((x) => ({ key: `work:${x.id}`, name: x.name, source: 'work', people: [...new Set(w.filter((m) => m.workspaceId === x.id).map((m) => m.userId))].filter((i) => i !== userId) })),
      ],
    };
  }

  // ---------- email ----------

  /**
   * Send one email to each person ({first_name} is replaced per person). Each one is recorded
   * in CEO email history as sent / failed / not_sent (when the server has no mail set up).
   */
  async email(userId: number, dto: { recipientIds: number[]; subject: string; body: string }) {
    const ids = await this.checkPeople(userId, dto.recipientIds ?? []);
    const subject = (dto.subject ?? '').trim();
    const body = (dto.body ?? '').trim();
    if (!subject || subject.length > 200) throw new BadRequestException('Add a subject (up to 200 characters).');
    if (!body || body.length > 20000) throw new BadRequestException('Write the email (up to 20,000 characters).');
    const [sender, people] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { firstName: true, lastName: true } }),
      this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true } }),
    ]);
    const from = `${sender.firstName} ${sender.lastName}`.trim();
    const results: { id: number; name: string; status: 'sent' | 'failed' | 'not_sent'; error?: string }[] = [];
    for (const p of people) {
      const text = body.replace(/\{first_name\}/gi, p.firstName);
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2933">${esc(text).replace(/\n/g, '<br>')}<p style="margin-top:24px;color:#6b7280;font-size:12px">— ${esc(from)}, via EZ Manage CEO Tower</p></div>`;
      let status: 'sent' | 'failed' | 'not_sent' = 'sent';
      let error: string | undefined;
      try {
        const info = await this.mail.sendMail({ to: p.email, subject, html, text });
        if (!info) { status = 'not_sent'; error = 'Email is not set up on this server.'; }
      } catch (e) {
        status = 'failed'; error = (e as Error).message.slice(0, 200);
      }
      await this.prisma.ceoEmailHistory.create({ data: { sentById: userId, recipientId: p.id, subject, body: text, deliveryStatus: status } });
      results.push({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), status, ...(error ? { error } : {}) });
    }
    this.log.log(`CEO ${userId} emailed ${results.length} people (${results.filter((r) => r.status === 'sent').length} sent)`);
    return {
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      notSent: results.filter((r) => r.status === 'not_sent').length,
      results,
    };
  }

  async emailHistory(userId: number) {
    await this.reachable(userId);
    const rows = await this.prisma.ceoEmailHistory.findMany({
      where: { sentById: userId }, orderBy: { sentAt: 'desc' }, take: 150,
      select: { id: true, subject: true, body: true, deliveryStatus: true, sentAt: true, recipient: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
    });
    return rows;
  }

  // ---------- meetings ----------

  async listMeetings(userId: number, when: 'upcoming' | 'past') {
    await this.reachable(userId);
    const now = new Date();
    return this.prisma.ceoMeeting.findMany({
      where: { createdById: userId, ...(when === 'upcoming' ? { cancelledAt: null, scheduledAt: { gte: new Date(now.getTime() - 60 * 60_000) } } : { OR: [{ scheduledAt: { lt: new Date(now.getTime() - 60 * 60_000) } }, { cancelledAt: { not: null } }] }) },
      orderBy: { scheduledAt: when === 'upcoming' ? 'asc' : 'desc' }, take: 100,
      include: { attendees: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } } } },
    });
  }

  private checkMeeting(dto: { title?: string; scheduledAt?: string; meetingLink?: string | null; description?: string | null }, partial = false) {
    if (!partial || dto.title !== undefined) { const t = (dto.title ?? '').trim(); if (!t || t.length > 255) throw new BadRequestException('Name the meeting (up to 255 characters).'); }
    if (!partial || dto.scheduledAt !== undefined) {
      const at = new Date(dto.scheduledAt ?? '');
      if (isNaN(+at)) throw new BadRequestException('Pick a date and time.');
      if (+at < Date.now() - 60_000) throw new BadRequestException('Pick a time in the future.');
    }
    if (dto.meetingLink) {
      let u: URL;
      try { u = new URL(dto.meetingLink); } catch { throw new BadRequestException('The meeting link is not valid.'); }
      if (!['http:', 'https:'].includes(u.protocol)) throw new BadRequestException('Use a web link for the meeting (http or https).');
    }
  }

  async createMeeting(userId: number, dto: { title: string; description?: string; meetingLink?: string; scheduledAt: string; attendeeIds: number[] }) {
    this.checkMeeting(dto);
    const attendeeIds = await this.checkPeople(userId, dto.attendeeIds ?? []);
    return this.meetings.createMeeting(userId, { title: dto.title.trim(), description: dto.description?.trim() || undefined, meetingLink: dto.meetingLink?.trim() || undefined, scheduledAt: new Date(dto.scheduledAt).toISOString(), attendeeIds } as any);
  }

  async updateMeeting(userId: number, id: number, dto: { title?: string; description?: string | null; meetingLink?: string | null; scheduledAt?: string; attendeeIds?: number[] }) {
    await this.reachable(userId);
    this.checkMeeting(dto as any, true);
    const attendeeIds = dto.attendeeIds ? await this.checkPeople(userId, dto.attendeeIds) : undefined;
    return this.meetings.updateMeeting(userId, id, { ...dto, ...(attendeeIds ? { attendeeIds } : {}), ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt).toISOString() } : {}) } as any);
  }

  async cancelMeeting(userId: number, id: number) {
    await this.reachable(userId);
    const m = await this.prisma.ceoMeeting.findFirst({ where: { id, createdById: userId }, select: { cancelledAt: true } });
    if (!m) throw new NotFoundException('Meeting not found');
    if (m.cancelledAt) throw new BadRequestException('This meeting is already cancelled.');
    return this.meetings.cancelMeeting(userId, id);
  }
}
