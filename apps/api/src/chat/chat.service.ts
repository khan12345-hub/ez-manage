import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ChatChannelType } from 'generated/prisma/enums';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Channels ──────────────────────────────────────────────────────────────

  async getChannels(workspaceId: number, userId: number) {
    return this.prisma.chatChannel.findMany({
      where: {
        workspaceId,
        type: ChatChannelType.CHANNEL,
        members: { some: { userId } },
      },
      include: {
        members: { select: { userId: true, lastReadAt: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createChannel(workspaceId: number, userId: number, name: string, description?: string) {
    const channel = await this.prisma.chatChannel.create({
      data: {
        workspaceId,
        name,
        description,
        type: ChatChannelType.CHANNEL,
        createdById: userId,
        members: { create: { userId } },
      },
    });
    return channel;
  }

  async joinChannel(channelId: number, userId: number) {
    return this.prisma.chatMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId },
      update: {},
    });
  }

  async leaveChannel(channelId: number, userId: number) {
    await this.prisma.chatMember.deleteMany({ where: { channelId, userId } });
    return { left: true };
  }

  // ── Direct Messages ───────────────────────────────────────────────────────

  async getDMs(workspaceId: number, userId: number) {
    return this.prisma.chatChannel.findMany({
      where: {
        workspaceId,
        type: ChatChannelType.DIRECT,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, userId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOrCreateDM(workspaceId: number, userAId: number, userBId: number) {
    // Find existing DM between the two users
    const existing = await this.prisma.chatChannel.findFirst({
      where: {
        workspaceId,
        type: ChatChannelType.DIRECT,
        members: { some: { userId: userAId } },
        AND: [{ members: { some: { userId: userBId } } }],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (existing) return existing;

    return this.prisma.chatChannel.create({
      data: {
        workspaceId,
        type: ChatChannelType.DIRECT,
        createdById: userAId,
        members: {
          create: [{ userId: userAId }, { userId: userBId }],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async getMessages(channelId: number, userId: number, cursor?: number, limit = 50) {
    const member = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this channel');

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        channelId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Update lastReadAt
    await this.prisma.chatMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });

    return messages.reverse();
  }

  async saveMessage(channelId: number, userId: number, content: string) {
    const member = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this channel');

    const message = await this.prisma.chatMessage.create({
      data: { channelId, userId, content },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    await this.prisma.chatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async deleteMessage(messageId: number, userId: number) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.userId !== userId) throw new ForbiddenException('Cannot delete others\' messages');
    await this.prisma.chatMessage.delete({ where: { id: messageId } });
    return { deleted: true };
  }

  async markRead(channelId: number, userId: number) {
    await this.prisma.chatMember.updateMany({
      where: { channelId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  async getUnreadCounts(workspaceId: number, userId: number) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId, channel: { workspaceId } },
      select: {
        channelId: true,
        lastReadAt: true,
      },
    });

    const counts: Record<number, number> = {};
    for (const m of memberships) {
      counts[m.channelId] = await this.prisma.chatMessage.count({
        where: {
          channelId: m.channelId,
          userId: { not: userId },
          createdAt: m.lastReadAt ? { gt: m.lastReadAt } : undefined,
        },
      });
    }
    return counts;
  }

  async getWorkspaceMembers(workspaceId: number) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        userId: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async ensureGeneralChannel(workspaceId: number, userId: number) {
    const existing = await this.prisma.chatChannel.findFirst({
      where: { workspaceId, name: 'general', type: ChatChannelType.CHANNEL },
    });
    if (existing) {
      // Make sure this user is a member
      await this.prisma.chatMember.upsert({
        where: { channelId_userId: { channelId: existing.id, userId } },
        create: { channelId: existing.id, userId },
        update: {},
      });
      return existing;
    }
    // Create #general and add ALL workspace members
    const channel = await this.prisma.chatChannel.create({
      data: {
        workspaceId,
        name: 'general',
        description: 'General workspace channel',
        type: ChatChannelType.CHANNEL,
        createdById: userId,
      },
    });
    const members = await this.prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    await this.prisma.chatMember.createMany({
      data: members.map((m) => ({ channelId: channel.id, userId: m.userId })),
      skipDuplicates: true,
    });
    return channel;
  }
}
