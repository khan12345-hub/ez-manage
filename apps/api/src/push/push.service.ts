import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from 'prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const email = process.env.VAPID_EMAIL ?? 'admin@ezmanage.app';
    if (pub && priv) {
      webpush.setVapidDetails(`mailto:${email}`, pub, priv);
      this.enabled = true;
      this.logger.log('Web Push enabled');
    } else {
      this.logger.warn('VAPID keys not set — browser push notifications disabled');
    }
  }

  getPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY ?? '';
  }

  async subscribe(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    return { ok: true };
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { ok: true };
  }

  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const json = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            json,
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            // Subscription expired or invalid — clean it up
            await this.prisma.pushSubscription.deleteMany({
              where: { userId, endpoint: sub.endpoint },
            });
          }
        }
      }),
    );
  }
}
