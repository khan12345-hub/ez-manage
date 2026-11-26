import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'generated/prisma/enums';
import { CreateMeetingDto, UpdateMeetingDto } from '../dto/meeting.dto';
import { WorkNotifyService } from 'src/work/work-notify.service';
import { MailService } from 'src/mail/mail.service';
import { buildIcs, type IcsPerson } from './ics.util';

type InviteMeeting = { icalUid: string; sequence: number; title: string; description: string | null; meetingLink: string | null; scheduledAt: Date };

const escapeHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class CeoMeetingService {
  private readonly logger = new Logger(CeoMeetingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly workNotify?: WorkNotifyService,
    @Optional() private readonly mail?: MailService,
  ) {}

  private personName(u: { firstName?: string | null; lastName?: string | null }) {
    return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || undefined;
  }

  /** Email every attendee (and the organizer) a branded invite with an attached .ics so the meeting
   *  lands on their Google / Outlook / Apple calendar. METHOD:REQUEST creates/updates, CANCEL removes. */
  private async emailInvite(m: InviteMeeting, organizer: IcsPerson, attendees: IcsPerson[], kind: 'REQUEST' | 'CANCEL') {
    if (!this.mail || !attendees.length) return;
    const start = new Date(m.scheduledAt);
    const end = new Date(start.getTime() + 60 * 60_000);
    const ics = buildIcs({
      uid: m.icalUid, sequence: m.sequence, method: kind, status: kind === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
      title: m.title, description: m.description, location: m.meetingLink, start, end, organizer, attendees,
    });
    const whenStr = this.formatDate(start);
    const cancelled = kind === 'CANCEL';
    const subject = `${cancelled ? 'Cancelled' : 'Invitation'}: ${m.title} — ${whenStr}`;
    const brass = '#b08d57', forest = '#0f2e22';
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2b23">
      <div style="background:${forest};border-radius:16px;padding:22px 24px;color:#eef3f0">
        <div style="font:600 12px/1 Arial;letter-spacing:.14em;text-transform:uppercase;color:${brass}">EZ Manage · Executive Hub</div>
        <div style="font-size:22px;font-weight:600;margin-top:8px">${cancelled ? 'Meeting cancelled' : 'You’re invited'}</div>
      </div>
      <div style="padding:22px 4px">
        <div style="font-size:18px;font-weight:600;${cancelled ? 'text-decoration:line-through;color:#8a9a92' : ''}">${escapeHtml(m.title)}</div>
        <div style="margin-top:6px;color:#55665e;font-size:14px">🗓️ ${escapeHtml(whenStr)}</div>
        ${m.description ? `<div style="margin-top:12px;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapeHtml(m.description)}</div>` : ''}
        ${!cancelled && m.meetingLink ? `<a href="${escapeHtml(m.meetingLink)}" style="display:inline-block;margin-top:18px;background:${forest};color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px">Join the meeting</a>` : ''}
        <div style="margin-top:18px;color:#8a9a92;font-size:12px">${cancelled ? 'This meeting has been removed from your calendar.' : 'This invite was added to your calendar. You’ll be reminded before it starts.'}</div>
      </div>
    </div>`;
    const text = `${cancelled ? 'Cancelled: ' : ''}${m.title}\n${whenStr}${m.description ? `\n\n${m.description}` : ''}${!cancelled && m.meetingLink ? `\n\nJoin: ${m.meetingLink}` : ''}`;
    // Organizer gets the invite too, so it lands on their calendar as well.
    const recipients = [organizer, ...attendees].filter((p, i, arr) => p.email && arr.findIndex((x) => x.email.toLowerCase() === p.email.toLowerCase()) === i);
    await Promise.allSettled(
      recipients.map((r) =>
        this.mail!.sendMail({ to: r.email, subject, html, text, icalEvent: { method: kind, filename: 'invite.ics', content: ics } })
          .catch((e: Error) => this.logger.warn(`ICS invite failed for ${r.email}: ${e.message}`)),
      ),
    );
  }

  /** a meeting notice: the usual (Boards) notification, plus the Work inbox for people who use Work */
  private async tell(n: { recipientId: number; title: string; message: string; sendEmail: boolean; meetingId?: number }) {
    await this.notifications.notify({ recipientId: n.recipientId, type: NotificationType.CEO_TASK_REMINDER, title: n.title, message: n.message, sendEmail: n.sendEmail });
    if (!this.workNotify) return;
    const inWork = await this.prisma.workMember.findFirst({ where: { userId: n.recipientId, workspace: { deletedAt: null } }, select: { workspaceId: true } });
    if (inWork) await this.workNotify.send({ recipientId: n.recipientId, type: 'MEETING', title: n.title, message: n.message, metadata: { event: 'meeting', meetingId: n.meetingId ?? null } }).catch(() => {});
  }

  async createMeeting(createdById: number, dto: CreateMeetingDto) {
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { firstName: true, lastName: true, email: true },
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Management';

    const attendees = await this.prisma.user.findMany({
      where: { id: { in: dto.attendeeIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const meeting = await this.prisma.ceoMeeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        meetingLink: dto.meetingLink,
        scheduledAt: new Date(dto.scheduledAt),
        createdById,
        notifInitialSent: true,
        attendees: { create: attendees.map((a) => ({ userId: a.id })) },
      },
      include: {
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
        },
      },
    });

    const dateStr = this.formatDate(new Date(dto.scheduledAt));

    // in-app notice (Boards + Work inbox); email goes out as a calendar invite below, so sendEmail:false here
    await Promise.allSettled(
      attendees.map(({ id, email }) =>
        this.tell({ recipientId: id, meetingId: meeting.id,
                        title: `Meeting Scheduled: ${dto.title}`,
            message: `${creatorName} has scheduled a meeting on ${dateStr}.`,
            sendEmail: false,
          })
          .catch((err: Error) => this.logger.warn(`Notify failed for ${email}: ${err.message}`)),
      ),
    );

    // calendar invite (.ics) so it lands on everyone's Google / Outlook / Apple calendar
    if (creator?.email) {
      await this.emailInvite(
        meeting,
        { email: creator.email, name: creatorName },
        attendees.map((a) => ({ email: a.email, name: this.personName(a) })),
        'REQUEST',
      );
    }

    return meeting;
  }

  async getMeetings(userId: number, upcoming = true) {
    const now = new Date();
    return this.prisma.ceoMeeting.findMany({
      where: {
        createdById: userId,
        cancelledAt: null,
        ...(upcoming ? { scheduledAt: { gte: now } } : {}),
      },
      include: {
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /** Upcoming, non-cancelled meetings the user created or is an attendee of. */
  async getMyUpcomingMeetings(userId: number) {
    return this.prisma.ceoMeeting.findMany({
      where: {
        cancelledAt: null,
        scheduledAt: { gte: new Date() },
        OR: [{ createdById: userId }, { attendees: { some: { userId } } }],
      },
      include: {
        attendees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });
  }

  async updateMeeting(userId: number, meetingId: number, dto: UpdateMeetingDto) {
    const meeting = await this.prisma.ceoMeeting.findFirst({
      where: { id: meetingId, createdById: userId, cancelledAt: null },
      include: { attendees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } } },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const timeChanged = dto.scheduledAt && new Date(dto.scheduledAt).getTime() !== meeting.scheduledAt.getTime();

    // Collect added/removed user details before syncing
    let addedUsers:   { id: number; email: string }[] = [];
    let removedUsers: { id: number; email: string }[] = [];

    if (dto.attendeeIds !== undefined) {
      const existingIds = meeting.attendees.map((a) => a.userId);
      const toAddIds    = dto.attendeeIds.filter((id) => !existingIds.includes(id));
      const toRemoveIds = existingIds.filter((id) => !dto.attendeeIds!.includes(id));

      // Fetch details for people being added (for notifications)
      if (toAddIds.length) {
        const addedFull = await this.prisma.user.findMany({
          where: { id: { in: toAddIds } },
          select: { id: true, email: true },
        });
        addedUsers = addedFull;
      }

      // Capture removed users before deleting
      removedUsers = meeting.attendees
        .filter((a) => toRemoveIds.includes(a.userId))
        .map((a) => ({ id: a.userId, email: a.user.email }));

      if (toRemoveIds.length) {
        await this.prisma.ceoMeetingAttendee.deleteMany({ where: { meetingId, userId: { in: toRemoveIds } } });
      }
      if (toAddIds.length) {
        await this.prisma.ceoMeetingAttendee.createMany({ data: toAddIds.map((uid) => ({ meetingId, userId: uid })) });
      }
    }

    const updated = await this.prisma.ceoMeeting.update({
      where: { id: meetingId },
      data: {
        sequence: { increment: 1 }, // bump so calendar clients treat the re-sent .ics as an update
        ...(dto.title !== undefined       ? { title: dto.title }        : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.meetingLink !== undefined ? { meetingLink: dto.meetingLink } : {}),
        ...(dto.scheduledAt               ? { scheduledAt: new Date(dto.scheduledAt),
                                              notif24hSent: false, notif1hSent: false, notif15mSent: false } : {}),
      },
      include: {
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } } },
      },
    });

    const dateStr = this.formatDate(updated.scheduledAt);

    // in-app notices (email handled by the .ics calendar invite below)
    if (timeChanged) {
      await Promise.allSettled(
        updated.attendees.map(({ user }) =>
          this.tell({ recipientId: user.id, meetingId,
                        title: `Meeting Rescheduled: ${updated.title}`,
            message: `The meeting has been moved to ${dateStr}.`,
            sendEmail: false,
          }).catch((err: Error) => this.logger.warn(`Reschedule notify failed: ${err.message}`)),
        ),
      );
    }

    // Notify newly added attendees
    if (addedUsers.length) {
      await Promise.allSettled(
        addedUsers.map(({ id, email }) =>
          this.tell({ recipientId: id, meetingId,
                        title: `You've been added to: ${updated.title}`,
            message: `You are now an attendee for the meeting scheduled on ${dateStr}.`,
            sendEmail: false,
          }).catch((err: Error) => this.logger.warn(`Add-attendee notify failed for ${email}: ${err.message}`)),
        ),
      );
    }

    // Notify removed attendees
    if (removedUsers.length) {
      await Promise.allSettled(
        removedUsers.map(({ id, email }) =>
          this.tell({ recipientId: id, meetingId,
                        title: `Removed from meeting: ${updated.title}`,
            message: `You have been removed from the meeting scheduled on ${dateStr}.`,
            sendEmail: false,
          }).catch((err: Error) => this.logger.warn(`Remove-attendee notify failed for ${email}: ${err.message}`)),
        ),
      );
    }

    // Re-send the calendar invite so everyone's calendar reflects the change; removed people get a cancel.
    const metaChanged = dto.title !== undefined || dto.description !== undefined || dto.meetingLink !== undefined;
    const organizer = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (organizer?.email) {
      const org: IcsPerson = { email: organizer.email, name: this.personName(organizer) };
      if (timeChanged || addedUsers.length || metaChanged) {
        await this.emailInvite(updated, org, updated.attendees.map((a) => ({ email: a.user.email, name: this.personName(a.user) })), 'REQUEST');
      }
      if (removedUsers.length) {
        await this.emailInvite(updated, org, removedUsers.map((u) => ({ email: u.email })), 'CANCEL');
      }
    }

    return updated;
  }

  async cancelMeeting(userId: number, meetingId: number) {
    const meeting = await this.prisma.ceoMeeting.findFirst({
      where: { id: meetingId, createdById: userId },
      include: {
        attendees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    const cancelled = await this.prisma.ceoMeeting.update({
      where: { id: meetingId },
      data: { cancelledAt: new Date(), sequence: { increment: 1 } },
    });

    const dateStr = this.formatDate(meeting.scheduledAt);
    await Promise.allSettled(
      meeting.attendees.map(({ user }) =>
        this.tell({ recipientId: user.id, meetingId,
                        title: `Meeting Cancelled: ${meeting.title}`,
            message: `The meeting scheduled for ${dateStr} has been cancelled.`,
            sendEmail: false,
          })
          .catch((err: Error) => this.logger.warn(`Cancel notify failed for ${user.email}: ${err.message}`)),
      ),
    );

    // remove it from everyone's calendar
    if (meeting.createdBy?.email) {
      await this.emailInvite(
        cancelled,
        { email: meeting.createdBy.email, name: this.personName(meeting.createdBy) },
        meeting.attendees.map((a) => ({ email: a.user.email, name: this.personName(a.user) })),
        'CANCEL',
      );
    }

    return { success: true };
  }

  // ─── Reminder Cron (runs every minute) ─────────────────────────────────────

  @Cron('* * * * *')
  async sendReminders() {
    const now = new Date();

    const windows = [
      { minutesBefore: 24 * 60, flag: 'notif24hSent' as const, label: '24 hours',   sendEmail: true  },
      { minutesBefore: 60,      flag: 'notif1hSent'  as const, label: '1 hour',     sendEmail: true  },
      { minutesBefore: 15,      flag: 'notif15mSent' as const, label: '15 minutes', sendEmail: false },
    ];

    for (const w of windows) {
      const target = new Date(now.getTime() + w.minutesBefore * 60_000);
      const from   = new Date(target.getTime() - 30_000);
      const to     = new Date(target.getTime() + 30_000);

      const meetings = await this.prisma.ceoMeeting.findMany({
        where: { cancelledAt: null, scheduledAt: { gte: from, lte: to }, [w.flag]: false },
        include: {
          attendees: { include: { user: { select: { id: true, email: true } } } },
          createdBy: { select: { id: true, email: true } },
        },
      });

      for (const meeting of meetings) {
        const dateStr = this.formatDate(meeting.scheduledAt);

        // Notify attendees + creator, deduped so creator isn't notified twice if they added themselves
        const attendeeIds = new Set(meeting.attendees.map((a) => a.user.id));
        const recipients = [...meeting.attendees.map((a) => a.user)];
        if (!attendeeIds.has(meeting.createdBy.id)) recipients.push(meeting.createdBy);

        await Promise.allSettled(
          recipients.map((user) =>
            this.tell({ recipientId: user.id,
                                title: `Reminder: ${meeting.title}`,
                message: `Your meeting starts in ${w.label}. Scheduled for ${dateStr}.`,
                sendEmail: w.sendEmail,
              })
              .catch((err: Error) => this.logger.warn(`Reminder notify failed for ${user.email}: ${err.message}`)),
          ),
        );
        await this.prisma.ceoMeeting.update({ where: { id: meeting.id }, data: { [w.flag]: true } });
      }
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
