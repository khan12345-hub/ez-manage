import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';

/**
 * Plain injectable — no @Processor / WorkerHost.
 * WorkerHost creates the BullMQ Worker at DI time (before onModuleInit),
 * which immediately runs Lua scripts that require Redis 7+.
 * Local dev uses Redis 3/5 so we create the Worker manually and only in production.
 */
@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[NotificationsProcessor] Skipping worker (local dev — Redis <7 incompatible with BullMQ 6 Lua scripts)');
      return;
    }

    this.worker = new Worker(
      'notifications',
      async (job: Job) => {
        switch (job.name) {
          case 'send-email':
            return this.sendEmail(job as Job<{ notificationId: string }>);
          default:
            throw new Error(`Unknown notification job: ${job.name}`);
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT || 6379),
        },
        concurrency: 5,
      },
    );

    this.worker.on('error', (err) => {
      console.error('[NotificationsProcessor] Worker error:', err.message);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async sendEmail(job: Job<{ notificationId: string }>) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: { recipient: true },
    });

    if (!notification) return;
    const user = notification.recipient;
    if (!user.email) return;

    await this.mailService.sendNotificationEmail({
      to: user.email,
      subject: notification.title,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata as Record<string, any> | undefined,
    });
  }
}
