import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationEntityType,
  NotificationType,
} from 'generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue,
  ) {}

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
  }) {
    console.log('[NotificationsService] notify() called', params);

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

    if (userPrefs && !userPrefs.inAppNotificationsEnabled) {
      console.log('[NotificationsService] In-app notifications disabled for user', recipientId);
      return null;
    }

    const effectiveSendEmail = sendEmailParam && (userPrefs?.emailNotificationsEnabled ?? true);

    /**
     * Check duplicate event.
     *
     * If the existing notification is unread, return it (no need for a new one).
     * If it has already been read, clear its eventKey so we can create a fresh notification.
     */
    if (eventKey) {
      console.log('[NotificationsService] Checking eventKey:', eventKey);

      const existing = await this.prisma.notification.findUnique({
        where: {
          eventKey,
        },
      });

      console.log('[NotificationsService] Existing notification:', existing);

      if (existing) {
        if (!existing.isRead) {
          console.log(
            '[NotificationsService] Unread duplicate found. Returning existing.',
            existing.id,
          );
          return existing;
        }

        // Already read — clear the old eventKey so we can create a new notification
        console.log(
          '[NotificationsService] Read duplicate found. Clearing eventKey to allow re-notification.',
          existing.id,
        );
        await this.prisma.notification.update({
          where: { id: existing.id },
          data: { eventKey: null },
        });
      }
    }

    /**
     * Create notification.
     */
    console.log('[NotificationsService] Creating notification...');

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
      },
    });

    console.log(
      '[NotificationsService] Notification successfully created:',
      notification,
    );

    /**
     * Queue email.
     *
     * Wrapped in try-catch: a queue failure (e.g. incompatible Redis version)
     * must not block the in-app notification that was already created above.
     */
    if (effectiveSendEmail) {
      try {
        console.log('[NotificationsService] Queueing email:', notification.id);

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

        console.log('[NotificationsService] Email queued:', notification.id);
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
  async findAll(recipientId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: {
          recipientId,
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
   * Get unread notification count.
   */
  async getUnreadCount(recipientId: number) {
    return this.prisma.notification.count({
      where: {
        recipientId,
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
  async markAllAsRead(recipientId: number) {
    return this.prisma.notification.updateMany({
      where: {
        recipientId,

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
  async removeAll(recipientId: number) {
    await this.prisma.notification.deleteMany({
      where: { recipientId },
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
