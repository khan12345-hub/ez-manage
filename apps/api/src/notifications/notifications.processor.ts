import {
  Processor,
  WorkerHost,
} from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "src/mail/mail.service";

@Processor("notifications")
export class NotificationsProcessor
  extends WorkerHost
{
  constructor(
    private readonly prisma: PrismaService,

    private readonly mailService: MailService,
  ) {
    super();
  }

  /**
   * Skip BullMQ Worker startup outside production.
   * Local dev uses Redis 3.x which doesn't support the Lua commands BullMQ requires.
   * On production (Redis 5+) the worker starts normally.
   */
  async onModuleInit() {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[NotificationsProcessor] Skipping worker startup (Redis <5 local dev mode)');
      return;
    }
    // Call WorkerHost.prototype.onModuleInit without using "super as any" (invalid cast)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentProto = Object.getPrototypeOf(NotificationsProcessor.prototype) as any;
    return parentProto.onModuleInit?.call(this);
  }

  async process(
    job: Job,
  ) {
    switch (job.name) {
      case "send-email":
        return this.sendEmail(job);

      default:
        throw new Error(
          `Unknown notification job: ${job.name}`,
        );
    }
  }

  private async sendEmail(
    job: Job<{
      notificationId: string;
    }>,
  ) {
    const notification =
      await this.prisma.notification.findUnique({
        where: {
          id: job.data.notificationId,
        },

        include: {
          recipient: true,
        },
      });

    if (!notification) {
      return;
    }

    const user =
      notification.recipient;

    if (!user.email) {
      return;
    }

    await this.mailService.sendNotificationEmail({
      to: user.email,
      subject: notification.title,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata as Record<string, any> | undefined,
    });
  }
}