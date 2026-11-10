import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';

export interface WorkNotice {
  recipientId: number;
  type: string;
  title: string;
  message: string;
  taskId?: number | null;
  metadata?: Record<string, unknown>;
  eventKey?: string;
  sendEmail?: boolean;
}

/**
 * Work's own notifications: stored in work_notifications (never in the Boards
 * notification table) and pushed live over the user's open stream.
 */
@Injectable()
export class WorkNotifyService {
  private readonly logger = new Logger(WorkNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
    private readonly mail: MailService,
  ) {}

  /** the shape the web app expects for an Inbox item */
  static shape<T extends { taskId: number | null }>(n: T) {
    return { ...n, entityId: n.taskId, entityType: n.taskId ? 'TASK' : null, product: 'work' as const };
  }

  async send(n: WorkNotice) {
    try {
      if (n.eventKey) {
        const existing = await this.prisma.workNotification.findUnique({ where: { eventKey: n.eventKey } });
        if (existing && !existing.isRead) return existing;
        if (existing) await this.prisma.workNotification.update({ where: { id: existing.id }, data: { eventKey: null } });
      }
      const row = await this.prisma.workNotification.create({
        data: {
          recipientId: n.recipientId,
          type: n.type,
          title: n.title,
          message: n.message,
          taskId: n.taskId ?? null,
          metadata: { product: 'work', ...(n.metadata ?? {}) } as any,
          eventKey: n.eventKey,
        },
      });
      this.stream.emit(n.recipientId, WorkNotifyService.shape(row));
      if (n.sendEmail) {
        const to = await this.prisma.user.findUnique({ where: { id: n.recipientId }, select: { email: true } });
        if (to?.email) {
          await this.mail.sendNotificationEmail({ to: to.email, subject: n.title, title: n.title, message: n.message, metadata: n.metadata as any }).catch((e: any) => this.logger.warn(`work email failed: ${e?.message ?? e}`));
        }
      }
      return row;
    } catch (e: any) {
      this.logger.warn(`work notification failed: ${e?.message ?? e}`);
      return null;
    }
  }
}
