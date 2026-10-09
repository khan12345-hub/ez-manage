import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from 'prisma/prisma.service';
import { ChatChannelType, ChatNotifPref, NotificationType, NotificationEntityType } from 'generated/prisma/enums';
import { NotificationsService } from 'src/notifications/notifications.service';

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  // ── Link preview cache (in-memory, 1-hour TTL) ────────────────────────────
  private readonly previewCache = new Map<string, { data: LinkPreviewData; expiresAt: number }>();

  async getLinkPreview(rawUrl: string): Promise<LinkPreviewData> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
      // Block private IPs to prevent SSRF
      if (/^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|::1$|0\.0\.0\.0)/.test(parsed.hostname)) {
        return { url: rawUrl, title: null, description: null, image: null, siteName: null };
      }
    } catch {
      return { url: rawUrl, title: null, description: null, image: null, siteName: null };
    }

    const cacheKey = parsed.href;
    const cached = this.previewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(parsed.href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EzManage-Bot/1.0; +https://ezmanage.app)', Accept: 'text/html' },
        signal: ctrl.signal,
        redirect: 'follow',
      }).finally(() => clearTimeout(timer));

      if (!res.ok) return { url: rawUrl, title: null, description: null, image: null, siteName: null };
      const html = await res.text();

      const og = (prop: string) => {
        const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']{1,500})["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:${prop}["']`, 'i'));
        return m?.[1]?.trim() ?? null;
      };
      const meta = (name: string) => {
        const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']{1,500})["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']${name}["']`, 'i'));
        return m?.[1]?.trim() ?? null;
      };
      const titleTag = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() ?? null;

      let image = og('image') || meta('twitter:image') || null;
      if (image && !image.startsWith('http')) {
        try { image = new URL(image, parsed.origin).href; } catch { image = null; }
      }

      const data: LinkPreviewData = {
        url: parsed.href,
        title: og('title') || meta('twitter:title') || titleTag,
        description: og('description') || meta('description') || meta('twitter:description') || null,
        image,
        siteName: og('site_name') || parsed.hostname,
      };

      this.previewCache.set(cacheKey, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
      if (this.previewCache.size > 500) this.previewCache.delete(this.previewCache.keys().next().value!);

      return data;
    } catch {
      return { url: rawUrl, title: null, description: null, image: null, siteName: null };
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Guard helpers ─────────────────────────────────────────────────────────

  async assertChannelMember(channelId: number, userId: number) {
    const member = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this channel');
  }

  async assertNotGeneralChannel(channelId: number) {
    const channel = await this.prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (channel?.name === 'general') {
      throw new ForbiddenException('Members cannot be removed from the #general channel');
    }
  }

  async assertWorkspaceMember(workspaceId: number, userId: number) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('You are not a member of this workspace');
  }

  // ── Channels ──────────────────────────────────────────────────────────────

  async getChannels(workspaceId: number, userId: number) {
    return this.prisma.chatChannel.findMany({
      where: {
        workspaceId,
        type: ChatChannelType.CHANNEL,
        members: { some: { userId } },
      },
      include: {
        members: { select: { userId: true, lastReadAt: true, notifPref: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createChannel(
    workspaceId: number,
    userId: number,
    name: string,
    description?: string,
    memberIds: number[] = [],
  ) {
    // Always include the creator; merge with any extra invited members
    const uniqueIds = Array.from(new Set([userId, ...memberIds]));
    const channel = await this.prisma.chatChannel.create({
      data: {
        workspaceId,
        name,
        description,
        type: ChatChannelType.CHANNEL,
        createdById: userId,
        members: { create: uniqueIds.map((uid) => ({ userId: uid })) },
      },
    });
    return channel;
  }

  async updateChannel(channelId: number, name?: string, description?: string) {
    return this.prisma.chatChannel.update({
      where: { id: channelId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
      },
    });
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

  async getDMs(userId: number, workspaceId: number) {
    const dms = await this.prisma.chatChannel.findMany({
      where: {
        workspaceId,
        type: ChatChannelType.DIRECT,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, chatStatusEmoji: true, chatStatusText: true } },
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

    // Keep only one DM per unique other user (most recent wins — already sorted by updatedAt desc)
    const seen = new Set<number>();
    return dms.filter((dm) => {
      const other = dm.members.find((m) => m.userId !== userId);
      if (!other) return false;
      if (seen.has(other.userId)) return false;
      seen.add(other.userId);
      return true;
    });
  }

  async getOrCreateDM(userAId: number, userBId: number, workspaceId?: number) {
    const dmInclude = {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, chatStatusEmoji: true, chatStatusText: true } },
        },
      },
    };

    // Find existing DM scoped to this workspace
    const existing = await this.prisma.chatChannel.findFirst({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        type: ChatChannelType.DIRECT,
        members: { some: { userId: userAId } },
        AND: [{ members: { some: { userId: userBId } } }],
      },
      orderBy: { updatedAt: 'desc' },
      include: dmInclude,
    });

    if (existing) return existing;

    // workspaceId is passed as a fallback when DB still has NOT NULL constraint
    // (before `prisma db push` makes it nullable). Remove once migration runs.
    return this.prisma.chatChannel.create({
      data: {
        ...(workspaceId ? { workspaceId } : {}),
        type: ChatChannelType.DIRECT,
        createdById: userAId,
        members: {
          create: [{ userId: userAId }, { userId: userBId }],
        },
      },
      include: dmInclude,
    });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  private readonly msgInclude = {
    user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    _count: { select: { replies: true } },
    channel: { select: { workspaceId: true } },
    reactions: { select: { id: true, userId: true, emoji: true } },
  } as const;

  async getMessages(channelId: number, userId: number, cursor?: number, limit = 50) {
    const member = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this channel');

    // Only top-level messages (no replies) — replies load separately per thread
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        channelId,
        parentId: null,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: this.msgInclude,
    });

    await this.prisma.chatMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { lastReadAt: new Date() },
    });

    return messages.reverse();
  }

  async getReplies(messageId: number) {
    return this.prisma.chatMessage.findMany({
      where: { parentId: messageId },
      orderBy: { createdAt: 'asc' },
      include: this.msgInclude,
    });
  }

  async saveMessage(
    channelId: number,
    userId: number,
    content: string,
    attachmentUrl?: string,
    attachmentType?: string,
    parentId?: number,
  ) {
    const member = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this channel');

    const message = await this.prisma.chatMessage.create({
      data: { channelId, userId, content, attachmentUrl, attachmentType, parentId },
      include: this.msgInclude,
    });

    await this.prisma.chatChannel.update({
      where: { id: channelId },
      data: { updatedAt: new Date() },
    });

    // Detect @mentions and notify mentioned users
    void this.processMentions(message.id, channelId, userId, content);

    return message;
  }

  private async processMentions(messageId: number, channelId: number, senderId: number, content: string) {
    const mentionPattern = /@([a-zA-Z0-9_.-]+(?:\s[a-zA-Z0-9_.-]+)?)/g;
    const matches = [...content.matchAll(mentionPattern)].map((m) => m[1].toLowerCase());
    if (!matches.length) return;

    const members = await this.prisma.chatMember.findMany({
      where: { channelId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    const sender = members.find((m) => m.userId === senderId)?.user;
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Someone';

    for (const m of members) {
      if (m.userId === senderId) continue;
      const fullName = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
      const firstName = m.user.firstName.toLowerCase();
      if (matches.some((mention) => fullName.startsWith(mention) || firstName === mention)) {
        void this.notificationsService.notify({
          recipientId: m.userId,
          type: NotificationType.COMMENT_MENTION,
          title: `${senderName} mentioned you in chat`,
          message: content.length > 100 ? `${content.slice(0, 100)}…` : content,
          entityType: NotificationEntityType.COMMENT,
          entityId: messageId,
          eventKey: `chat_mention_${messageId}_${m.userId}`,
          sendEmail: true,
        });
      }
    }
  }

  async saveCallMessage(channelId: number, userId: number, callType: string) {
    const msg = await this.prisma.chatMessage.create({
      data: { channelId, userId, content: '', isSystemMessage: true, callType, callStatus: 'ongoing' },
      include: this.msgInclude,
    });
    await this.prisma.chatChannel.update({ where: { id: channelId }, data: { updatedAt: new Date() } });
    return msg;
  }

  async updateCallStatus(messageId: number, callStatus: string, callDuration?: number) {
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { callStatus, ...(callDuration != null ? { callDuration } : {}) },
      include: this.msgInclude,
    });
  }

  async assignMessage(messageId: number, assigneeId: number, assignerId: number) {
    const msg = await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { assignedToId: assigneeId, assignedById: assignerId },
      include: this.msgInclude,
    });
    return msg;
  }

  async toggleReaction(messageId: number, userId: number, emoji: string) {
    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.chatReaction.create({ data: { messageId, userId, emoji } });
    }
    return this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: this.msgInclude,
    });
  }

  async editMessage(messageId: number, userId: number, content: string) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.userId !== userId) throw new ForbiddenException('Cannot edit others\' messages');
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content: content.trim(), editedAt: new Date() },
      include: this.msgInclude,
    });
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
      where: {
        userId,
        channel: { workspaceId },
      },
      select: {
        channelId: true,
        lastReadAt: true,
      },
    });

    if (!memberships.length) return {};

    // Fire all count queries concurrently instead of sequentially (N → parallel N)
    const entries = await Promise.all(
      memberships.map(async (m) => {
        const count = await this.prisma.chatMessage.count({
          where: {
            channelId: m.channelId,
            userId: { not: userId },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        });
        return [m.channelId, count] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  async getWorkspaceMembers(workspaceId: number) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        userId: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, chatStatusEmoji: true, chatStatusText: true } },
      },
    });
  }

  // Returns ALL users in the system for DM picker (ClickUp-style: DM anyone in org)
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        email: true, phone: true,
        whatsappPhone: true, whatsappEnabled: true,
        lastLoginAt: true, createdAt: true,
        chatStatusEmoji: true, chatStatusText: true,
      },
      orderBy: { firstName: 'asc' },
    });
    return users.map((u) => ({ userId: u.id, user: u }));
  }

  async getChannelMembers(channelId: number): Promise<{ userId: number; notifPref: string }[]> {
    return this.prisma.chatMember.findMany({
      where: { channelId },
      select: { userId: true, notifPref: true },
    });
  }

  async getChannelMembersFull(channelId: number) {
    return this.prisma.chatMember.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, chatStatusEmoji: true, chatStatusText: true } },
      },
    });
  }

  async setChannelPref(
    channelId: number,
    userId: number,
    pref: ChatNotifPref,
  ) {
    await this.assertChannelMember(channelId, userId);
    return this.prisma.chatMember.update({
      where: { channelId_userId: { channelId, userId } },
      data: { notifPref: pref },
      select: { notifPref: true },
    });
  }

  async getChannelPref(channelId: number, userId: number): Promise<string> {
    const m = await this.prisma.chatMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { notifPref: true },
    });
    return m?.notifPref ?? 'ALL';
  }

  async addChannelMember(channelId: number, targetUserId: number) {
    const cid = Number(channelId);
    const uid = Number(targetUserId);
    return this.prisma.chatMember.upsert({
      where: { channelId_userId: { channelId: cid, userId: uid } },
      create: { channelId: cid, userId: uid },
      update: {},
    });
  }

  async getWorkspaceMemberIds(workspaceId: number): Promise<number[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: Number(workspaceId) },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async removeChannelMember(channelId: number, targetUserId: number) {
    await this.prisma.chatMember.deleteMany({ where: { channelId, userId: targetUserId } });
  }

  // All channels for a user (used on socket connect to auto-join rooms)
  async getUserName(userId: number): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!u) return null;
    return `${u.firstName} ${u.lastName}`.trim();
  }

  async getUserChannelIds(userId: number): Promise<number[]> {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      select: { channelId: true },
    });
    return memberships.map((m) => m.channelId);
  }

  /** Returns per-workspace unread totals across ALL workspaces the user has channels in. */
  async getAllUnreadSummary(userId: number) {
    const memberships = await this.prisma.chatMember.findMany({
      where: { userId },
      select: {
        channelId: true,
        lastReadAt: true,
        channel: {
          select: {
            workspaceId: true,
            workspace: { select: { name: true } },
          },
        },
      },
    });

    // Count unread for all workspace channels in parallel
    const channelCounts = await Promise.all(
      memberships
        .filter((m) => m.channel.workspaceId != null)
        .map((m) =>
          this.prisma.chatMessage
            .count({
              where: {
                channelId: m.channelId,
                userId: { not: userId },
                ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
              },
            })
            .then((count) => ({
              workspaceId: m.channel.workspaceId as number,
              workspaceName: m.channel.workspace?.name ?? `Workspace ${m.channel.workspaceId}`,
              count,
            })),
        ),
    );

    // Aggregate per workspace
    const map = new Map<number, { workspaceName: string; totalUnread: number }>();
    for (const { workspaceId, workspaceName, count } of channelCounts) {
      const existing = map.get(workspaceId);
      if (existing) {
        existing.totalUnread += count;
      } else {
        map.set(workspaceId, { workspaceName, totalUnread: count });
      }
    }

    return Array.from(map.entries()).map(([workspaceId, data]) => ({
      workspaceId,
      workspaceName: data.workspaceName,
      totalUnread: data.totalUnread,
    }));
  }

  /** Runs at 3 AM daily — deletes chat upload files not referenced by any message (orphan cleanup). */
  @Cron('0 3 * * *')
  async cleanupOrphanedUploads() {
    const uploadsDir = join(process.cwd(), 'uploads', 'chat');
    try {
      const files = readdirSync(uploadsDir);
      let deleted = 0;
      for (const filename of files) {
        const attachmentUrl = `/uploads/chat/${filename}`;
        const referenced = await this.prisma.chatMessage.findFirst({
          where: { attachmentUrl },
          select: { id: true },
        });
        if (!referenced) {
          const filePath = join(uploadsDir, filename);
          const stat = statSync(filePath);
          const ageMs = Date.now() - stat.mtimeMs;
          if (ageMs > 24 * 60 * 60 * 1000) {
            unlinkSync(filePath);
            deleted++;
          }
        }
      }
      if (deleted > 0) this.logger.log(`Cleanup: deleted ${deleted} orphaned chat upload(s)`);
    } catch (err) {
      this.logger.error('Chat upload cleanup failed', err instanceof Error ? err.message : err);
    }
  }

  async ensureGeneralChannel(workspaceId: number, userId: number) {
    const generalWhere = { workspaceId, name: 'general', type: ChatChannelType.CHANNEL };

    // Atomic double-checked find-or-create inside a transaction
    let channel = await this.prisma.chatChannel.findFirst({ where: generalWhere });

    if (!channel) {
      try {
        channel = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.chatChannel.findFirst({ where: generalWhere });
          if (existing) return existing;
          return tx.chatChannel.create({
            data: {
              workspaceId,
              name: 'general',
              description: 'General workspace channel',
              type: ChatChannelType.CHANNEL,
              createdById: userId,
            },
          });
        });
      } catch {
        // Race condition — another request created it; find and return it
        channel = await this.prisma.chatChannel.findFirst({ where: generalWhere });
        if (!channel) throw new Error(`Failed to create #general for workspace ${workspaceId}`);
      }
    }

    // Deduplicate: if multiple #general exist (from previous race conditions), merge into the oldest
    const allGenerals = await this.prisma.chatChannel.findMany({
      where: generalWhere,
      orderBy: { createdAt: 'asc' },
    });
    if (allGenerals.length > 1) {
      channel = allGenerals[0]!;
      // Delete the duplicates (messages cascade)
      await this.prisma.chatChannel.deleteMany({
        where: { id: { in: allGenerals.slice(1).map((c) => c.id) } },
      });
    }

    // Sync ALL workspace members into #general (idempotent)
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    await this.prisma.chatMember.createMany({
      data: members.map((m) => ({ channelId: channel!.id, userId: m.userId })),
      skipDuplicates: true,
    });
    return channel;
  }

  // ── Message Search ────────────────────────────────────────────────────────

  async searchMessages(channelId: number, userId: number, query: string) {
    await this.assertChannelMember(channelId, userId);
    if (!query.trim()) return [];
    return this.prisma.chatMessage.findMany({
      where: {
        channelId,
        parentId: null,
        content: { contains: query.trim(), mode: 'insensitive' },
      },
      include: this.msgInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Pin Messages ──────────────────────────────────────────────────────────

  async pinMessage(messageId: number, userId: number, pin: boolean) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.assertChannelMember(msg.channelId, userId);
    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: pin },
      include: this.msgInclude,
    });
  }

  async getPinnedMessages(channelId: number, userId: number) {
    await this.assertChannelMember(channelId, userId);
    return this.prisma.chatMessage.findMany({
      where: { channelId, isPinned: true },
      include: this.msgInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Read Receipts ─────────────────────────────────────────────────────────

  async getSeenBy(messageId: number, userId: number) {
    const msg = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { channelId: true, createdAt: true },
    });
    if (!msg) throw new NotFoundException('Message not found');
    await this.assertChannelMember(msg.channelId, userId);

    // Members who read the channel AFTER this message was created
    const members = await this.prisma.chatMember.findMany({
      where: {
        channelId: msg.channelId,
        userId: { not: userId },
        lastReadAt: { gte: msg.createdAt },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    return members.map((m) => m.user);
  }
}
