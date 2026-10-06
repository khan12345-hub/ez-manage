import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'prisma/prisma.service';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Injectable()
export class ScheduledMessagesService {
  private readonly logger = new Logger(ScheduledMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async create(channelId: number, userId: number, content: string, scheduledAt: Date) {
    await this.chatService.assertChannelMember(channelId, userId);
    return this.prisma.scheduledMessage.create({
      data: { channelId, userId, content, scheduledAt },
      select: { id: true, channelId: true, userId: true, content: true, scheduledAt: true, status: true, createdAt: true },
    });
  }

  async list(channelId: number, userId: number) {
    await this.chatService.assertChannelMember(channelId, userId);
    return this.prisma.scheduledMessage.findMany({
      where: { channelId, status: 'PENDING' },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true, channelId: true, userId: true, content: true,
        scheduledAt: true, status: true, createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async cancel(id: number, userId: number) {
    const msg = await this.prisma.scheduledMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Scheduled message not found');
    if (msg.userId !== userId) throw new ForbiddenException('Cannot cancel others\' scheduled messages');
    if (msg.status !== 'PENDING') throw new ForbiddenException('Message already sent or cancelled');
    return this.prisma.scheduledMessage.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: { id: true, status: true },
    });
  }

  /** Runs every minute — sends any messages whose scheduledAt has passed */
  @Cron('* * * * *')
  async sendDueMessages() {
    const due = await this.prisma.scheduledMessage.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
    });

    for (const sm of due) {
      try {
        const message = await this.chatService.saveMessage(
          sm.channelId,
          sm.userId,
          sm.content,
        );
        await this.prisma.scheduledMessage.update({
          where: { id: sm.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
        // Broadcast to channel room
        this.chatGateway.server.to(`channel:${sm.channelId}`).emit('message:new', message);
        this.logger.log(`Sent scheduled message ${sm.id} to channel ${sm.channelId}`);
      } catch (err) {
        this.logger.error(`Failed to send scheduled message ${sm.id}:`, err);
      }
    }
  }
}
