import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType, NotificationEntityType } from 'generated/prisma/enums';

export const CEO_EMAIL_QUEUE = 'ceo-emails';

export interface CeoEmailJobData {
  historyId?: number;   // set for retries — updates existing record
  sentById: number;
  senderName: string;
  recipientId: number;
  subject: string;
  body: string;
}

@Injectable()
export class CeoEmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CeoEmailProcessor.name);
  private readonly loggedErrors = new Set<string>();
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('[CeoEmailQueue] Skipping worker (local dev — Redis <7 incompatible with BullMQ 6 Lua scripts)');
      return;
    }

    this.worker = new Worker(
      CEO_EMAIL_QUEUE,
      (job: Job<CeoEmailJobData>) => this.processJob(job),
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT || 6379),
        },
      },
    );

    this.worker.on('error', (err: Error) => {
      const key = err.message.slice(0, 80);
      if (!this.loggedErrors.has(key)) {
        this.loggedErrors.add(key);
        this.logger.warn(`[CeoEmailQueue] Worker error (suppressing repeats): ${err.message}`);
      }
    });
    this.worker.on('failed', (job, err: Error) => {
      this.logger.warn(`[CeoEmailQueue] Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async processJob(job: Job<CeoEmailJobData>): Promise<void> {
    const { historyId, sentById, senderName, recipientId, subject, body } = job.data;

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!recipient) {
      this.logger.warn(`Recipient ${recipientId} not found — skipping job ${job.id}`);
      return;
    }

    const recipientName = `${recipient.firstName} ${recipient.lastName}`;

    try {
      await this.mailService.sendMail({
        to: recipient.email,
        subject,
        html: this.buildHtml(body, senderName),
        text: body,
      });

      if (historyId) {
        // Retry path — update existing record to 'sent'
        await this.prisma.ceoEmailHistory.update({
          where: { id: historyId },
          data: { deliveryStatus: 'sent', sentAt: new Date() },
        });
      } else {
        // New send — create history record
        await this.prisma.ceoEmailHistory.create({
          data: { sentById, recipientId, subject, body, deliveryStatus: 'sent' },
        });
      }

      void this.notificationsService.notify({
        recipientId,
        type: NotificationType.CEO_TASK_REMINDER,
        title: `Task follow-up from ${senderName}`,
        message: subject,
        entityType: NotificationEntityType.TASK,
        metadata: { senderName, subject },
        sendEmail: false,
      });

      if (sentById !== recipientId) {
        void this.notificationsService.notify({
          recipientId: sentById,
          type: NotificationType.CEO_TASK_REMINDER,
          title: `Email sent to ${recipientName}`,
          message: `"${subject}" delivered successfully.`,
          entityType: NotificationEntityType.TASK,
          metadata: { recipientName, recipientId },
          sendEmail: false,
        });
      }

      this.logger.log(`Email delivered to ${recipient.email} (job ${job.id})`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${recipient.email} (job ${job.id})`, err);

      if (!historyId) {
        // Create failed history record so it shows in audit log
        await this.prisma.ceoEmailHistory.create({
          data: { sentById, recipientId, subject, body, deliveryStatus: 'failed' },
        }).catch(() => { /* ignore secondary failure */ });
      } else {
        // Keep history record as 'failed' on retry failure
        await this.prisma.ceoEmailHistory.update({
          where: { id: historyId },
          data: { deliveryStatus: 'failed' },
        }).catch(() => {});
      }

      throw err; // re-throw so BullMQ retries the job
    }
  }

  private buildHtml(body: string, senderName: string): string {
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px">
  <div style="border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px">
    <span style="font-size:13px;font-weight:700;color:#2563eb;letter-spacing:0.08em;text-transform:uppercase">EzManage · Task Reminder</span>
  </div>
  <div style="margin-bottom:32px">${escaped}</div>
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:12px;color:#64748b">
    Sent via EzManage CEO Dashboard · ${senderName}
  </div>
</body>
</html>`;
  }
}
