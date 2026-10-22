import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { CEO_EMAIL_QUEUE, CeoEmailJobData } from '../ceo-email.processor';
import { EmailDraftItemDto } from '../dto/send-emails.dto';

export interface SendResult {
  recipientId: number;
  recipientName: string;
  recipientEmail: string;
  success: boolean;
  historyId?: number;
  error?: string;
}

@Injectable()
export class EmailSenderService implements OnModuleInit {
  private readonly logger = new Logger(EmailSenderService.name);
  private readonly loggedErrors = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CEO_EMAIL_QUEUE) private readonly emailQueue: Queue<CeoEmailJobData>,
  ) {}

  onModuleInit() {
    this.emailQueue.on('error', (err: Error) => {
      const key = err.message.slice(0, 80);
      if (!this.loggedErrors.has(key)) {
        this.loggedErrors.add(key);
        this.logger.warn(`[CeoEmailQueue] Queue error (suppressing repeats): ${err.message}`);
      }
    });
  }

  /**
   * Queues one email job per draft. Returns immediately — the processor sends emails
   * in the background with up to 3 automatic retries on failure.
   */
  async sendBulk(params: {
    sentById: number;
    senderName: string;
    drafts: EmailDraftItemDto[];
  }): Promise<{ queued: number }> {
    const { sentById, senderName, drafts } = params;

    const jobs: CeoEmailJobData[] = drafts.map((d) => ({
      sentById,
      senderName,
      recipientId: d.recipientId,
      subject: d.subject,
      body: d.body,
    }));

    try {
      await this.emailQueue.addBulk(
        jobs.map((data) => ({
          name: 'send-email',
          data,
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2_000 },
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 100 },
          },
        })),
      );
    } catch (err) {
      this.logger.error(`[CeoEmailQueue] Failed to queue ${jobs.length} email(s): ${err instanceof Error ? err.message : err}`);
      throw new Error('Email queue temporarily unavailable. Please upgrade Redis to v7.2+ for email queuing.');
    }

    this.logger.log(`Queued ${jobs.length} CEO email job(s) for sender ${sentById}`);
    return { queued: jobs.length };
  }

  /**
   * Queues a retry for a single failed history record.
   * The processor will update the existing history record to 'sent' on success.
   */
  async retryEmail(historyId: number, sentById: number): Promise<{ queued: number }> {
    const history = await this.prisma.ceoEmailHistory.findFirst({
      where: { id: historyId, sentById, deliveryStatus: 'failed' },
      select: { id: true, recipientId: true, subject: true, body: true },
    });

    if (!history) {
      throw new NotFoundException('Failed history record not found or already sent.');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: sentById },
      select: { firstName: true, lastName: true },
    });

    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Management';

    // Mark as pending so it doesn't show as failed while retrying
    await this.prisma.ceoEmailHistory.update({
      where: { id: historyId },
      data: { deliveryStatus: 'pending' },
    });

    try {
      await this.emailQueue.add('send-email', {
        historyId: history.id,
        sentById,
        senderName,
        recipientId: history.recipientId,
        subject: history.subject,
        body: history.body,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      });
    } catch (err) {
      this.logger.error(`[CeoEmailQueue] Failed to queue retry for history ${historyId}: ${err instanceof Error ? err.message : err}`);
      // Restore failed status since we couldn't queue the retry
      await this.prisma.ceoEmailHistory.update({
        where: { id: historyId },
        data: { deliveryStatus: 'failed' },
      }).catch(() => {});
      throw new Error('Email queue temporarily unavailable.');
    }

    return { queued: 1 };
  }
}
