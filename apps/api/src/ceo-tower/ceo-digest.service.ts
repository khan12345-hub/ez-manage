import { BadRequestException, ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { WorkNotifyService } from 'src/work/work-notify.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationType } from 'generated/prisma/enums';
import { CeoTowerService } from './ceo-tower.service';
import { CeoAiService } from './ceo-ai.service';

type Settings = { briefOn: boolean; briefEmail: boolean; briefHour: number; timezone: string; alertsOn: boolean; lastBriefOn: string | null; health: Record<string, string> | null };
const DEFAULTS: Settings = { briefOn: true, briefEmail: false, briefHour: 8, timezone: 'Asia/Karachi', alertsOn: true, lastBriefOn: null, health: null };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "now" in a timezone: local date (YYYY-MM-DD) and hour */
function localNow(tz: string) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
  } catch {
    const d = new Date();
    return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
  }
}

/**
 * CEO Tower in the background, every 10 minutes, for everyone who has CEO Tower:
 *  - the morning brief (AI-written, in their Boards + Work inbox, optionally by email) once a day
 *    after the hour they chose, in their timezone;
 *  - an alert when one of their companies turns red (only on the change, never repeated);
 *  - a daily snapshot of each company's open / overdue / done counts for the trend charts.
 */
@Injectable()
export class CeoDigestService {
  private readonly log = new Logger('CeoDigest');
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tower: CeoTowerService,
    private readonly ai: CeoAiService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    @Optional() private readonly workNotify?: WorkNotifyService,
  ) {}

  // ---------- settings ----------

  private async load(userId: number): Promise<Settings> {
    const row = await this.prisma.ceoSetting.findUnique({ where: { userId } });
    return row ? { ...DEFAULTS, ...row, health: (row.health as Record<string, string> | null) ?? null } : { ...DEFAULTS };
  }

  async settings(userId: number) {
    const a = await this.tower.access(userId);
    if (!a.allowed) throw new ForbiddenException('Executive Hub is for company owners and the people they share it with.');
    const s = await this.load(userId);
    return { briefOn: s.briefOn, briefEmail: s.briefEmail, briefHour: s.briefHour, timezone: s.timezone, alertsOn: s.alertsOn, lastBriefOn: s.lastBriefOn };
  }

  async saveSettings(userId: number, dto: Partial<Pick<Settings, 'briefOn' | 'briefEmail' | 'briefHour' | 'timezone' | 'alertsOn'>>) {
    await this.settings(userId);
    const data: Record<string, unknown> = {};
    for (const k of ['briefOn', 'briefEmail', 'alertsOn'] as const) if (typeof dto[k] === 'boolean') data[k] = dto[k];
    if (dto.briefHour !== undefined) {
      const h = Number(dto.briefHour);
      if (!Number.isInteger(h) || h < 0 || h > 23) throw new BadRequestException('Pick an hour from 0 to 23.');
      data.briefHour = h;
    }
    if (dto.timezone !== undefined) {
      try { new Intl.DateTimeFormat('en', { timeZone: String(dto.timezone) }); } catch { throw new BadRequestException('Unknown timezone.'); }
      data.timezone = String(dto.timezone);
    }
    await this.prisma.ceoSetting.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return this.settings(userId);
  }

  // ---------- the schedule ----------

  /** everyone who has CEO Tower: owners of a Boards / Work company, and people an owner shared it with */
  private async ceoIds() {
    const [b, w, g] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { role: 'OWNER', deletedAt: null, user: { deletedAt: null } }, select: { userId: true } }),
      this.prisma.workMember.findMany({ where: { role: 'OWNER', workspace: { deletedAt: null }, user: { deletedAt: null } }, select: { userId: true } }),
      this.prisma.ceoAccessGrant.findMany({ select: { userId: true } }),
    ]);
    return [...new Set([...b, ...w, ...g].map((r) => r.userId))];
  }

  @Cron('*/10 * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const id of await this.ceoIds()) {
        try { await this.runFor(id); } catch (e) { this.log.warn(`CEO ${id}: ${(e as Error).message}`); }
      }
    } finally {
      this.running = false;
    }
  }

  /** one CEO: alerts + snapshots, then the brief when it is due */
  async runFor(userId: number) {
    const s = await this.load(userId);
    const access = await this.tower.access(userId);
    if (!access.allowed) return;
    const o = await this.tower.overview(userId, 'all');
    await this.snapshot(o.companies);
    if (s.alertsOn) await this.alerts(userId, s, o.companies);
    const now = localNow(s.timezone);
    if (s.briefOn && now.hour >= s.briefHour && s.lastBriefOn !== now.date) await this.sendBrief(userId, s, now.date);
  }

  /** "Send me the brief now" from the settings screen */
  async briefNow(userId: number) {
    const s = await this.load(userId);
    await this.settings(userId);
    return this.sendBrief(userId, s, localNow(s.timezone).date);
  }

  private async sendBrief(userId: number, s: Settings, day: string) {
    const brief = await this.ai.brief(userId, true);
    const title = 'Your morning brief';
    const message = brief.bullets.map((b) => `• ${b}`).join('\n');
    await this.tell(userId, title, message, 'ceo_brief');
    let emailed: 'sent' | 'not_sent' | 'failed' | 'off' = 'off';
    if (s.briefEmail) {
      const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
      if (me?.email) {
        try {
          const html = `<p>Good morning ${esc(me.firstName ?? '')},</p><p>Here is what happened across your companies in the last 24 hours:</p><ul>${brief.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul><p>Open Executive Hub for details.</p>`;
          const info = await this.mail.sendMail({ to: me.email, subject: `Executive Hub · morning brief ${day}`, html, text: `${title}\n\n${message}` } as any);
          emailed = info ? 'sent' : 'not_sent';
        } catch (e) {
          emailed = 'failed';
          this.log.warn(`brief email to ${userId} failed: ${(e as Error).message}`);
        }
      }
    }
    await this.prisma.ceoSetting.upsert({ where: { userId }, create: { userId, lastBriefOn: day }, update: { lastBriefOn: day } });
    return { sent: true, day, bullets: brief.bullets, emailed };
  }

  /** alert only when a company turns red; the first run just records how things stand */
  private async alerts(userId: number, s: Settings, companies: { key: string; name: string; source: string; health: string; stats: { overdue: number; open: number } }[]) {
    const next = Object.fromEntries(companies.map((c) => [c.key, c.health]));
    if (s.health) {
      for (const c of companies) {
        if (c.health === 'critical' && s.health[c.key] !== 'critical') {
          await this.tell(userId, `${c.name} needs your attention`, `${c.name} (${c.source === 'work' ? 'Work' : 'Boards'}) now has ${c.stats.overdue} overdue of ${c.stats.open} open tasks.`, 'ceo_alert');
        }
      }
    }
    await this.prisma.ceoSetting.upsert({ where: { userId }, create: { userId, health: next }, update: { health: next } });
  }

  /** today's numbers per company (UTC day); re-running the same day keeps the latest */
  private async snapshot(companies: { key: string; stats: { total: number; open: number; overdue: number; done: number } }[]) {
    const day = new Date().toISOString().slice(0, 10);
    for (const c of companies) {
      const v = { total: c.stats.total, open: c.stats.open, overdue: c.stats.overdue, done: c.stats.done };
      await this.prisma.ceoSnapshot.upsert({ where: { companyKey_day: { companyKey: c.key, day } }, create: { companyKey: c.key, day, ...v }, update: v });
    }
  }

  /** into the CEO's own inbox: Boards always, Work too when they are in Work. Never emailed from here. */
  private async tell(userId: number, title: string, message: string, event: string) {
    await this.notifications.notify({ recipientId: userId, type: NotificationType.CEO_TASK_REMINDER, title, message, metadata: { url: '/ceo', event }, sendEmail: false }).catch(() => {});
    const inWork = await this.prisma.workMember.findFirst({ where: { userId, workspace: { deletedAt: null } }, select: { userId: true } });
    if (inWork && this.workNotify) await this.workNotify.send({ recipientId: userId, type: event === 'ceo_alert' ? 'CEO_ALERT' : 'CEO_BRIEF', title, message, metadata: { event, url: '/ceo' } }).catch(() => {});
  }
}
