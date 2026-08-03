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

      subject:
        notification.title,

      title:
        notification.title,

      message:
        notification.message,

      metadata:
        notification.metadata,
    });
  }
}