import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'generated/prisma/enums';
import { CreateMeetingDto, UpdateMeetingDto } from '../dto/meeting.dto';

@Injectable()
export class CeoMeetingService {
  private readonly logger = new Logger(CeoMeetingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createMeeting(createdById: number, dto: CreateMeetingDto) {
    const creator = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { firstName: true, lastName: true },
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

    await Promise.allSettled(
      attendees.map(({ id, email }) =>
        this.notifications
          .notify({
            recipientId: id,
            type: NotificationType.CEO_TASK_REMINDER,
            title: `Meeting Scheduled: ${dto.title}`,
            message: `${creatorName} has scheduled a meeting on ${dateStr}.`,
            sendEmail: true,
          })
          .catch((err: Error) => this.logger.warn(`Notify failed for ${email}: ${err.message}`)),
      ),
    );

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

    // Notify all current attendees if time changed
    if (timeChanged) {
      await Promise.allSettled(
        updated.attendees.map(({ user }) =>
          this.notifications.notify({
            recipientId: user.id,
            type: NotificationType.CEO_TASK_REMINDER,
            title: `Meeting Rescheduled: ${updated.title}`,
            message: `The meeting has been moved to ${dateStr}.`,
            sendEmail: true,
          }).catch((err: Error) => this.logger.warn(`Reschedule notify failed: ${err.message}`)),
        ),
      );
    }

    // Notify newly added attendees
    if (addedUsers.length) {
      await Promise.allSettled(
        addedUsers.map(({ id, email }) =>
          this.notifications.notify({
            recipientId: id,
            type: NotificationType.CEO_TASK_REMINDER,
            title: `You've been added to: ${updated.title}`,
            message: `You are now an attendee for the meeting scheduled on ${dateStr}.`,
            sendEmail: true,
          }).catch((err: Error) => this.logger.warn(`Add-attendee notify failed for ${email}: ${err.message}`)),
        ),
      );
    }

    // Notify removed attendees
    if (removedUsers.length) {
      await Promise.allSettled(
        removedUsers.map(({ id, email }) =>
          this.notifications.notify({
            recipientId: id,
            type: NotificationType.CEO_TASK_REMINDER,
            title: `Removed from meeting: ${updated.title}`,
            message: `You have been removed from the meeting scheduled on ${dateStr}.`,
            sendEmail: false,
          }).catch((err: Error) => this.logger.warn(`Remove-attendee notify failed for ${email}: ${err.message}`)),
        ),
      );
    }

    return updated;
  }

  async cancelMeeting(userId: number, meetingId: number) {
    const meeting = await this.prisma.ceoMeeting.findFirst({
      where: { id: meetingId, createdById: userId },
      include: {
        attendees: { include: { user: { select: { id: true, email: true } } } },
      },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    await this.prisma.ceoMeeting.update({
      where: { id: meetingId },
      data: { cancelledAt: new Date() },
    });

    const dateStr = this.formatDate(meeting.scheduledAt);
    await Promise.allSettled(
      meeting.attendees.map(({ user }) =>
        this.notifications
          .notify({
            recipientId: user.id,
            type: NotificationType.CEO_TASK_REMINDER,
            title: `Meeting Cancelled: ${meeting.title}`,
            message: `The meeting scheduled for ${dateStr} has been cancelled.`,
            sendEmail: false,
          })
          .catch((err: Error) => this.logger.warn(`Cancel notify failed for ${user.email}: ${err.message}`)),
      ),
    );

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
            this.notifications
              .notify({
                recipientId: user.id,
                type: NotificationType.CEO_TASK_REMINDER,
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
