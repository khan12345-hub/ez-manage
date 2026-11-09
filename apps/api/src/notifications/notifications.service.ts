import { Inject, Injectable, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import {
  NotificationEntityType,
  NotificationType,
} from 'generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// WhatsApp hook — remove this import to disable WhatsApp notifications
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly loggedQueueErrors = new Set<string>();

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue,

    // WhatsApp hook — remove this param + @Optional() to disable
    @Optional() private readonly whatsapp: WhatsappService,

    @Optional() private readonly mailService: MailService,

    @Optional() private readonly pushService: PushService,
  ) {}

  onModuleInit() {
    // BullMQ forwards IORedis connection errors to queue.on('error').
    // Without a listener, Node.js treats them as uncaught exceptions and crashes the process.
    this.notificationsQueue.on('error', (err: Error) => {
      const key = err.message.slice(0, 80);
      if (!this.loggedQueueErrors.has(key)) {
        this.loggedQueueErrors.add(key);
        console.warn('[NotificationsQueue] Redis error (suppressing repeats):', err.message);
      }
    });
  }

  /**
   * Create an in-app notification
   * and optionally queue an email.
   */
  async notify(params: {
    recipientId: number;

    type: NotificationType;

    title: string;

    message: string;

    entityType?: NotificationEntityType;

    entityId?: number;

    metadata?: Record<string, any>;

    eventKey?: string;

    sendEmail?: boolean;

    /** boards (default) | work */
    product?: 'boards' | 'work';
  }) {

    const {
      recipientId,
      type,
      title,
      message,
      entityType,
      entityId,
      metadata,
      eventKey,
      sendEmail: sendEmailParam = true,
      product = 'boards',
    } = params;

    /**
     * Check user notification preferences.
     */
    const userPrefs = await this.prisma.user.findFirst({
      where: { id: recipientId },
      select: {
        inAppNotificationsEnabled: true,
        emailNotificationsEnabled: true,
      },
    });

    const shouldSendInApp = !userPrefs || userPrefs.inAppNotificationsEnabled;
    const effectiveSendEmail = sendEmailParam && (!userPrefs || userPrefs.emailNotificationsEnabled);

    // Both channels disabled — nothing to do
    if (!shouldSendInApp && !effectiveSendEmail) {
      return null;
    }

    // In-app OFF but email ON — send email directly, skip DB notification
    if (!shouldSendInApp && effectiveSendEmail && this.mailService) {
      try {
        const recipient = await this.prisma.user.findUnique({
          where: { id: recipientId },
          select: { email: true },
        });
        if (recipient?.email) {
          await this.mailService.sendNotificationEmail({
            to: recipient.email,
            subject: title,
            title,
            message,
            metadata,
          });
        }
      } catch (err) {
        console.error('[NotificationsService] Email-only send failed:', err instanceof Error ? err.message : err);
      }
      return null;
    }

    /**
     * Check duplicate event.
     *
     * If the existing notification is unread, return it (no need for a new one).
     * If it has already been read, clear its eventKey so we can create a fresh notification.
     */
    if (eventKey) {

      const existing = await this.prisma.notification.findUnique({
        where: {
          eventKey,
        },
      });

      if (existing) {
        if (!existing.isRead) {
          return existing;
        }

        // Already read — clear the old eventKey so we can create a new notification
        await this.prisma.notification.update({
          where: { id: existing.id },
          data: { eventKey: null },
        });
      }
    }

    /**
     * Create notification.
     */

    const notification = await this.prisma.notification.create({
      data: {
        recipientId,

        type,

        title,

        message,

        entityType,

        entityId,

        metadata,

        eventKey,

        product,
      },
    });

    // â”€â”€ WhatsApp hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (this.whatsapp && entityId && metadata?.boardId) {
      void (async () => {
        try {
          const prefs = await this.prisma.user.findUnique({
            where: { id: recipientId },
            select: {
              whatsappOnAssigned: true,
              whatsappOnStatus: true,
              whatsappOnDate: true,
              whatsappOnComment: true,
              whatsappOnMention: true,
              whatsappOnAutomation: true,
            },
          });

          const allowed =
            !prefs ||
            (type === NotificationType.TASK_ASSIGNED       && (prefs.whatsappOnAssigned   ?? true)) ||
            (type === NotificationType.TASK_STATUS_CHANGED && (prefs.whatsappOnStatus     ?? true)) ||
            (type === NotificationType.TASK_DUE_SOON       && (prefs.whatsappOnDate       ?? true)) ||
            (type === NotificationType.COMMENT_CREATED     && (prefs.whatsappOnComment    ?? true)) ||
            (type === NotificationType.COMMENT_REPLY       && (prefs.whatsappOnComment    ?? true)) ||
            (type === NotificationType.COMMENT_MENTION     && (prefs.whatsappOnMention    ?? true)) ||
            (type === NotificationType.AUTOMATION          && (prefs.whatsappOnAutomation ?? true)) ||
            (type === NotificationType.FILE_COMMENT        && (prefs.whatsappOnComment    ?? true)) ||
            // For other types (board membership etc.) always send if WhatsApp is enabled
            !(([
              NotificationType.TASK_ASSIGNED, NotificationType.TASK_STATUS_CHANGED,
              NotificationType.TASK_DUE_SOON, NotificationType.COMMENT_CREATED,
              NotificationType.COMMENT_REPLY, NotificationType.COMMENT_MENTION,
              NotificationType.AUTOMATION, NotificationType.FILE_COMMENT,
            ] as NotificationType[]).includes(type));

          if (allowed) {
            await this.whatsapp.sendToUser(recipientId, `ðŸ“‹ ${title}\n${message}`).catch(() => {});
            await this.whatsapp.updateSession(recipientId, entityId, Number(metadata.boardId)).catch(() => {});
          }
        } catch { /* non-critical */ }
      })();
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // ── Web Push ──────────────────────────────────────────────────────────────
    if (this.pushService) {
      const pushUrl = metadata?.workspaceId && metadata?.boardId
        ? `/workspace/${metadata.workspaceId}/board/${metadata.boardId}`
        : '/dashboard';
      void this.pushService.sendToUser(recipientId, {
        title,
        body: message,
        url: pushUrl,
        tag: type,
      }).catch(() => {});
    }
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Queue email.
     *
     * Wrapped in try-catch: a queue failure (e.g. incompatible Redis version)
     * must not block the in-app notification that was already created above.
     */
    if (effectiveSendEmail && process.env.NODE_ENV === 'production') {
      try {

        await this.notificationsQueue.add(
          'send-email',
          {
            notificationId: notification.id,
          },
          {
            jobId: eventKey
              ? `notification-email-${eventKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`
              : `notification-email-${notification.id}`,

            attempts: 3,

            backoff: {
              type: 'exponential',
              delay: 5000,
            },

            removeOnComplete: true,

            removeOnFail: false,
          },
        );
      } catch (err) {
        console.error(
          '[NotificationsService] Failed to queue email (in-app notification still delivered):',
          err instanceof Error ? err.message : err,
        );
      }
    }

    return notification;
  }

  /**
   * Get paginated notifications.
   */
  async findAll(recipientId: number, page = 1, limit = 20, product?: 'boards' | 'work') {
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: {
          recipientId,
          ...(product ? { product } : {}),
        },

        orderBy: {
          createdAt: 'desc',
        },

        skip,

        take: limit,
      }),

      this.prisma.notification.count({
        where: {
          recipientId,
          ...(product ? { product } : {}),
        },
      }),
    ]);

    return {
      data: notifications,

      meta: {
        page,

        limit,

        total,

        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Inbox (ClickUp-style): Primary = not cleared and not snoozed,
   * Later = snoozed into the future, Cleared = cleared.
   */
  async inbox(recipientId: number, tab: 'primary' | 'later' | 'cleared', opts: { unread?: boolean; product?: string; limit?: number } = {}) {
    const now = new Date();
    const tabWhere =
      tab === 'cleared'
        ? { clearedAt: { not: null } }
        : tab === 'later'
          ? { clearedAt: null, snoozedUntil: { gt: now } }
          : { clearedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] };
    const where: any = {
      recipientId,
      ...tabWhere,
      ...(opts.unread ? { isRead: false } : {}),
      ...(opts.product === 'work' || opts.product === 'boards' ? { product: opts.product } : {}),
    };
    const byProduct = opts.product === 'work' || opts.product === 'boards' ? { product: opts.product } : {};
    const base = { recipientId, clearedAt: null, ...byProduct };
    const [items, primaryUnread, later, cleared] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(opts.limit ?? 150, 300) }),
      this.prisma.notification.count({ where: { ...base, isRead: false, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] } }),
      this.prisma.notification.count({ where: { ...base, snoozedUntil: { gt: now } } }),
      this.prisma.notification.count({ where: { recipientId, ...byProduct, clearedAt: { not: null } } }),
    ]);
    return { items, counts: { primaryUnread, later, cleared } };
  }

  async inboxAction(notificationId: string, recipientId: number, action: string, until?: string) {
    const n = await this.prisma.notification.findFirst({ where: { id: notificationId, recipientId }, select: { id: true } });
    if (!n) throw new NotFoundException('Notification not found');
    const now = new Date();
    const data =
      action === 'clear' ? { clearedAt: now, snoozedUntil: null, isRead: true, readAt: now }
      : action === 'unclear' ? { clearedAt: null }
      : action === 'snooze' ? { snoozedUntil: until ? new Date(until) : new Date(now.getTime() + 86_400_000), clearedAt: null }
      : action === 'unsnooze' ? { snoozedUntil: null }
      : action === 'read' ? { isRead: true, readAt: now }
      : { isRead: false, readAt: null };
    return this.prisma.notification.update({ where: { id: n.id }, data });
  }

  /** Clear everything in Primary. */
  async clearAll(recipientId: number, product?: 'boards' | 'work') {
    const now = new Date();
    return this.prisma.notification.updateMany({
      where: { recipientId, ...(product ? { product } : {}), clearedAt: null, OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] },
      data: { clearedAt: now, isRead: true, readAt: now },
    });
  }

  /**
   * Get unread notification count.
   */
  async getUnreadCount(recipientId: number, product?: 'boards' | 'work') {
    return this.prisma.notification.count({
      where: {
        recipientId,
        ...(product ? { product } : {}),
        isRead: false,
      },
    });
  }

  /**
   * Mark one notification as read.
   */
  async markAsRead(notificationId: string, recipientId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,

        recipientId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: {
        id: notificationId,
      },

      data: {
        isRead: true,

        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(recipientId: number, product?: 'boards' | 'work') {
    return this.prisma.notification.updateMany({
      where: {
        recipientId,
        ...(product ? { product } : {}),

        isRead: false,
      },

      data: {
        isRead: true,

        readAt: new Date(),
      },
    });
  }

  /**
   * Delete all notifications for a user.
   */
  async removeAll(recipientId: number, product?: 'boards' | 'work') {
    await this.prisma.notification.deleteMany({
      where: { recipientId, ...(product ? { product } : {}) },
    });

    return { success: true };
  }

  /**
   * Delete notification.
   */
  async remove(notificationId: string, recipientId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,

        recipientId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: {
        id: notificationId,
      },
    });

    return {
      success: true,
    };
  }
}
