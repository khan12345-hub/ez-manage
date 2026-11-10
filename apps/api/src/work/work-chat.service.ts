import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { WorkAccessService } from './work-access.service';
import { ALLOWED_MIME_TYPES } from './work-files.service';
import { WorkNotifyService } from './work-notify.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '🔥', '✅', '🚀', '💯', '👏', '😮'];
const POST_TYPES = ['announcement', 'discussion', 'idea', 'update'];
const MSG_SELECT = {
  id: true, channelId: true, parentId: true, kind: true, title: true, postType: true, content: true, mentionIds: true, files: true,
  replyCount: true, lastReplyAt: true, alsoInChannel: true, pinnedAt: true, editedAt: true, deletedAt: true, createdAt: true, assigneeId: true, resolvedAt: true,
  user: { select: USER_MINI },
  reactions: { select: { emoji: true, userId: true } },
} as const;
const uid = () => randomUUID().replace(/-/g, '').slice(0, 12);
const name2key = (n: string) => n.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');

/**
 * Work Chat (ClickUp Chat): channels, DMs and group DMs, threads, posts, reactions,
 * pins, saved messages, drafts and unread counts. Fully separate from Boards chat.
 * Live updates go over the user's session-checked notification stream.
 */
@Injectable()
export class WorkChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly stream: NotificationStreamService,
    private readonly workNotify: WorkNotifyService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
  ) {}

  /* ── access ── */

  private async channel(channelUid: string, userId: number, level: 'view' | 'post' | 'manage' = 'view') {
    const ch = await this.prisma.workChannel.findFirst({ where: { uid: channelUid, archivedAt: null }, include: { members: { select: { userId: true, role: true, lastReadAt: true, muted: true, starred: true } } } });
    if (!ch) throw new NotFoundException('Channel not found.');
    const ws = await this.access.forWorkspace(ch.workspaceId, userId);
    const me = ch.members.find((m) => m.userId === userId);
    // public channels are open to everyone with full Work access; private channels and DMs only to members
    const open = ch.kind === 'channel' && !ch.isPrivate && ws.canView && ws.scope === 'all';
    if (!ws.canView || (!me && !open)) throw new NotFoundException('Channel not found.');
    if (level === 'post' && !(me || open) ) throw new ForbiddenException('Join the channel first.');
    if (level === 'post' && ws.role === 'GUEST' && !me) throw new ForbiddenException('Guests can only post in channels they were added to.');
    if (level === 'manage' && !(me?.role === 'owner' || ws.canManage)) throw new ForbiddenException('Only the channel owner or an admin can do this.');
    return { ch, me, ws };
  }

  /** push a live event to everyone in the channel (or a given list) */
  private push(userIds: number[], type: string, data: Record<string, unknown>) {
    for (const u of new Set(userIds)) this.stream.emitRaw(u, 'work_chat', { type, ...data });
  }
  private async audience(ch: { id: number; kind: string; isPrivate: boolean; workspaceId: number }) {
    if (ch.kind === 'channel' && !ch.isPrivate) {
      return (await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId, role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } }, select: { userId: true } })).map((m) => m.userId)
        .concat((await this.prisma.workChannelMember.findMany({ where: { channelId: ch.id }, select: { userId: true } })).map((m) => m.userId));
    }
    return (await this.prisma.workChannelMember.findMany({ where: { channelId: ch.id }, select: { userId: true } })).map((m) => m.userId);
  }

  /* ── channels ── */

  async sidebar(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChannel.findMany({
      where: {
        workspaceId, archivedAt: null,
        OR: [{ members: { some: { userId } } }, ...(ws.scope === 'all' ? [{ kind: 'channel', isPrivate: false }] : [])],
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: {
        id: true, uid: true, kind: true, name: true, description: true, topic: true, isPrivate: true, locationType: true, locationId: true, lastMessageAt: true, createdAt: true,
        members: { select: { userId: true, lastReadAt: true, muted: true, starred: true, user: { select: USER_MINI } } },
      },
    });
    const out: any[] = [];
    for (const c of rows) {
      const me = c.members.find((m) => m.userId === userId);
      const unread = me
        ? await this.prisma.workChatMessage.count({ where: { channelId: c.id, deletedAt: null, userId: { not: userId }, OR: [{ parentId: null }, { alsoInChannel: true }], ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}) } })
        : 0;
      const mentions = me
        ? await this.prisma.workChatMessage.count({ where: { channelId: c.id, deletedAt: null, mentionIds: { has: userId }, ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}) } })
        : 0;
      out.push({
        id: c.id, uid: c.uid, kind: c.kind, name: c.name, description: c.description, topic: c.topic, isPrivate: c.isPrivate, locationType: c.locationType, locationId: c.locationId,
        lastMessageAt: c.lastMessageAt, joined: !!me, muted: !!me?.muted, starred: !!me?.starred, unread, mentions,
        memberCount: c.members.length,
        // DMs show the other person / people
        people: c.kind === 'channel' ? [] : c.members.filter((m) => m.userId !== userId).map((m) => m.user),
      });
    }
    return out;
  }

  async create(workspaceId: number, userId: number, dto: { name: string; description?: string; isPrivate?: boolean; memberIds?: number[]; locationType?: string; locationId?: number }) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'edit');
    const name = name2key(dto.name ?? '');
    if (!name || name.length > 80) throw new BadRequestException('Name the channel (up to 80 characters).');
    if (await this.prisma.workChannel.findFirst({ where: { workspaceId, kind: 'channel', name, archivedAt: null } })) throw new BadRequestException(`#${name} already exists.`);
    const others = [...new Set(dto.memberIds ?? [])].filter((id) => id !== userId);
    if (others.length && !(await this.access.areMembers(workspaceId, others))) throw new BadRequestException('Channels can only include Work members.');
    if (dto.locationType && !['space', 'folder', 'list'].includes(dto.locationType)) throw new BadRequestException('Unknown location.');
    const ch = await this.prisma.workChannel.create({
      data: {
        uid: uid(), workspaceId, kind: 'channel', name, description: dto.description?.trim() || null, isPrivate: !!dto.isPrivate, createdById: userId,
        locationType: dto.locationType ?? null, locationId: dto.locationId ?? null,
        members: { create: [{ userId, role: 'owner' }, ...others.map((u) => ({ userId: u }))] },
      },
    });
    await this.system(ch.id, userId, `created #${name}`);
    this.push(await this.audience(ch), 'channel', { channelUid: ch.uid });
    void ws;
    return ch;
  }

  /** open (or reuse) a DM / group DM with exactly these people */
  async dm(workspaceId: number, userId: number, userIds: number[]) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const people = [...new Set([userId, ...userIds])];
    if (people.length < 2 && userIds[0] !== userId) throw new BadRequestException('Pick someone to message.');
    if (people.length > 9) throw new BadRequestException('Group messages are limited to 9 people.');
    if (!(await this.access.areMembers(workspaceId, people))) throw new BadRequestException('You can only message Work members.');
    const kind = people.length > 2 ? 'group' : 'dm';
    const candidates = await this.prisma.workChannel.findMany({
      where: { workspaceId, kind, archivedAt: null, members: { some: { userId } } },
      select: { id: true, uid: true, members: { select: { userId: true } } },
    });
    const same = candidates.find((c) => c.members.length === people.length && people.every((p) => c.members.some((m) => m.userId === p)));
    if (same) return { uid: same.uid, created: false };
    const ch = await this.prisma.workChannel.create({
      data: { uid: uid(), workspaceId, kind, isPrivate: true, createdById: userId, members: { create: people.map((u) => ({ userId: u, role: u === userId ? 'owner' : 'member' })) } },
    });
    return { uid: ch.uid, created: true };
  }

  async detail(channelUid: string, userId: number) {
    const { ch, me, ws } = await this.channel(channelUid, userId);
    const members = await this.prisma.workChannelMember.findMany({ where: { channelId: ch.id }, select: { role: true, joinedAt: true, user: { select: USER_MINI } }, orderBy: { joinedAt: 'asc' } });
    const pinned = await this.prisma.workChatMessage.findMany({ where: { channelId: ch.id, pinnedAt: { not: null }, deletedAt: null }, orderBy: { pinnedAt: 'desc' }, select: MSG_SELECT });
    return {
      id: ch.id, uid: ch.uid, kind: ch.kind, name: ch.name, description: ch.description, topic: ch.topic, isPrivate: ch.isPrivate, locationType: ch.locationType, locationId: ch.locationId,
      createdAt: ch.createdAt, joined: !!me, muted: !!me?.muted, starred: !!me?.starred, myRole: me?.role ?? null,
      canManage: me?.role === 'owner' || ws.canManage, members, pinned,
    };
  }

  async update(channelUid: string, userId: number, dto: { name?: string; description?: string | null; topic?: string | null; isPrivate?: boolean }) {
    const { ch } = await this.channel(channelUid, userId, 'manage');
    if (ch.kind !== 'channel') throw new BadRequestException('Direct messages have no settings.');
    let name: string | undefined;
    if (dto.name !== undefined) {
      name = name2key(dto.name);
      if (!name) throw new BadRequestException('Name the channel.');
      if (name !== ch.name && (await this.prisma.workChannel.findFirst({ where: { workspaceId: ch.workspaceId, kind: 'channel', name, archivedAt: null } }))) throw new BadRequestException(`#${name} already exists.`);
    }
    const up = await this.prisma.workChannel.update({
      where: { id: ch.id },
      data: { ...(name && { name }), ...(dto.description !== undefined && { description: dto.description?.trim() || null }), ...(dto.topic !== undefined && { topic: dto.topic?.trim() || null }), ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }) },
    });
    if (name && name !== ch.name) await this.system(ch.id, userId, `renamed the channel to #${name}`);
    this.push(await this.audience(up), 'channel', { channelUid: ch.uid });
    return up;
  }

  async archive(channelUid: string, userId: number) {
    const { ch } = await this.channel(channelUid, userId, 'manage');
    const audience = await this.audience(ch);
    await this.prisma.workChannel.update({ where: { id: ch.id }, data: { archivedAt: new Date() } });
    this.push(audience, 'channel', { channelUid: ch.uid, archived: true });
    return { archived: true };
  }

  async join(channelUid: string, userId: number) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (ch.kind !== 'channel') throw new BadRequestException('You can only join channels.');
    if (!me) {
      await this.prisma.workChannelMember.create({ data: { channelId: ch.id, userId, lastReadAt: new Date() } });
      await this.system(ch.id, userId, 'joined the channel');
      this.push(await this.audience(ch), 'channel', { channelUid: ch.uid });
    }
    return { joined: true };
  }

  async leave(channelUid: string, userId: number) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (!me) return { left: true };
    if (ch.kind === 'dm') throw new BadRequestException("You can't leave a direct message.");
    await this.prisma.workChannelMember.delete({ where: { channelId_userId: { channelId: ch.id, userId } } });
    await this.system(ch.id, userId, 'left the channel');
    this.push(await this.audience(ch), 'channel', { channelUid: ch.uid });
    return { left: true };
  }

  async addMembers(channelUid: string, userId: number, ids: number[]) {
    const { ch, me, ws } = await this.channel(channelUid, userId);
    if (!me && !ws.canManage) throw new ForbiddenException('Join the channel first.');
    if (ch.kind === 'dm') throw new BadRequestException('Start a group message to add people.');
    const add = [...new Set(ids)].filter((u) => !ch.members.some((m) => m.userId === u));
    if (!add.length) return { added: 0 };
    if (!(await this.access.areMembers(ch.workspaceId, add))) throw new BadRequestException('Only Work members can be added.');
    await this.prisma.workChannelMember.createMany({ data: add.map((u) => ({ channelId: ch.id, userId: u })), skipDuplicates: true });
    const names = await this.prisma.user.findMany({ where: { id: { in: add } }, select: { firstName: true, lastName: true } });
    await this.system(ch.id, userId, `added ${names.map((n) => `${n.firstName} ${n.lastName}`.trim()).join(', ')}`);
    this.push(add, 'channel', { channelUid: ch.uid });
    return { added: add.length };
  }

  async removeMember(channelUid: string, userId: number, target: number) {
    const { ch } = await this.channel(channelUid, userId, 'manage');
    if (ch.kind === 'dm') throw new BadRequestException("People can't be removed from a direct message.");
    await this.prisma.workChannelMember.deleteMany({ where: { channelId: ch.id, userId: target } });
    this.push([target], 'channel', { channelUid: ch.uid, removed: true });
    return { removed: true };
  }

  async setPrefs(channelUid: string, userId: number, dto: { muted?: boolean; starred?: boolean }) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (!me) throw new BadRequestException('Join the channel first.');
    await this.prisma.workChannelMember.update({ where: { channelId_userId: { channelId: ch.id, userId } }, data: { ...(dto.muted !== undefined && { muted: dto.muted }), ...(dto.starred !== undefined && { starred: dto.starred }) } });
    return { ok: true };
  }

  async markRead(channelUid: string, userId: number) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (me) await this.prisma.workChannelMember.update({ where: { channelId_userId: { channelId: ch.id, userId } }, data: { lastReadAt: new Date() } });
    return { ok: true };
  }

  /* ── messages ── */

  private shape(m: any, userId: number, saved?: Set<number>) {
    const deleted = !!m.deletedAt;
    return {
      ...m,
      content: deleted ? '' : m.content,
      files: deleted ? [] : m.files ?? [],
      title: deleted ? null : m.title,
      reactions: REACTIONS.map((e) => ({ emoji: e, userIds: m.reactions.filter((r: any) => r.emoji === e).map((r: any) => r.userId) })).filter((r) => r.userIds.length),
      saved: saved?.has(m.id) ?? false,
      mine: m.user.id === userId,
    };
  }

  async messages(channelUid: string, userId: number, opts: { before?: string; q?: string; posts?: boolean }) {
    const { ch } = await this.channel(channelUid, userId);
    const rows = await this.prisma.workChatMessage.findMany({
      where: {
        channelId: ch.id,
        OR: [{ parentId: null }, { alsoInChannel: true }],
        ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
        ...(opts.q ? { content: { contains: opts.q, mode: 'insensitive' as const }, deletedAt: null } : {}),
        ...(opts.posts ? { kind: 'post' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: MSG_SELECT,
    });
    const saved = new Set((await this.prisma.workChatSaved.findMany({ where: { userId, messageId: { in: rows.map((r) => r.id) } }, select: { messageId: true } })).map((s) => s.messageId));
    return { items: rows.reverse().map((m) => this.shape(m, userId, saved)), hasMore: rows.length === 50 };
  }

  async thread(messageId: number, userId: number) {
    const parent = await this.prisma.workChatMessage.findUnique({ where: { id: messageId }, select: { ...MSG_SELECT, channel: { select: { uid: true } } } });
    if (!parent) throw new NotFoundException('Message not found.');
    await this.channel(parent.channel.uid, userId);
    const replies = await this.prisma.workChatMessage.findMany({ where: { parentId: messageId }, orderBy: { createdAt: 'asc' }, select: MSG_SELECT });
    const saved = new Set((await this.prisma.workChatSaved.findMany({ where: { userId, messageId: { in: [messageId, ...replies.map((r) => r.id)] } }, select: { messageId: true } })).map((s) => s.messageId));
    const { channel, ...p } = parent as any;
    return { parent: this.shape(p, userId, saved), replies: replies.map((r) => this.shape(r, userId, saved)), channelUid: channel.uid };
  }

  private async system(channelId: number, userId: number, text: string) {
    await this.prisma.workChatMessage.create({ data: { channelId, userId, kind: 'system', content: text } });
  }

  async send(channelUid: string, userId: number, dto: { content?: string; parentId?: number; kind?: string; title?: string; postType?: string; mentionIds?: number[]; files?: any[]; alsoInChannel?: boolean }) {
    const { ch, me, ws } = await this.channel(channelUid, userId, 'post');
    const content = (dto.content ?? '').trim();
    const files = Array.isArray(dto.files) ? dto.files.slice(0, 10) : [];
    if (!content && !files.length) throw new BadRequestException('Write a message.');
    if (content.length > 20000) throw new BadRequestException('That message is too long.');
    const kind = dto.kind === 'post' ? 'post' : 'message';
    if (kind === 'post' && (!dto.title?.trim() || (dto.postType && !POST_TYPES.includes(dto.postType)))) throw new BadRequestException('Posts need a title.');
    let parent: { id: number; userId: number; parentId: number | null } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.workChatMessage.findFirst({ where: { id: dto.parentId, channelId: ch.id, deletedAt: null }, select: { id: true, userId: true, parentId: true } });
      if (!parent || parent.parentId) throw new BadRequestException('Reply to a message in this channel.');
    }
    // files must be ours (uploaded through /work/chat/files)
    for (const f of files) if (!f || typeof f.url !== 'string' || !/^https?:\/\//.test(f.url)) throw new BadRequestException('Invalid file.');
    const mentions = [...new Set(dto.mentionIds ?? [])].filter((u) => u !== userId);
    const valid = mentions.length ? (await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId, userId: { in: mentions } }, select: { userId: true } })).map((m) => m.userId) : [];
    // posting in an open channel you haven't joined joins you (like ClickUp)
    if (!me && ch.kind === 'channel') await this.prisma.workChannelMember.create({ data: { channelId: ch.id, userId, lastReadAt: new Date() } });
    const now = new Date();
    const msg = await this.prisma.workChatMessage.create({
      data: {
        channelId: ch.id, userId, parentId: parent?.id ?? null, kind, title: kind === 'post' ? dto.title!.trim().slice(0, 200) : null, postType: kind === 'post' ? dto.postType ?? 'announcement' : null,
        content, mentionIds: valid, files, alsoInChannel: !!(parent && dto.alsoInChannel),
      },
      select: MSG_SELECT,
    });
    await this.prisma.workChannel.update({ where: { id: ch.id }, data: { lastMessageAt: now } });
    if (parent) await this.prisma.workChatMessage.update({ where: { id: parent.id }, data: { replyCount: { increment: 1 }, lastReplyAt: now } });
    await this.prisma.workChannelMember.updateMany({ where: { channelId: ch.id, userId }, data: { lastReadAt: now } });
    const shaped = this.shape(msg, userId);
    this.push(await this.audience(ch), 'message', { channelUid: ch.uid, message: shaped });

    // notifications: mentions, direct messages, replies to my thread
    const author = msg.user;
    const who = `${author.firstName} ${author.lastName}`.trim();
    const snippet = (kind === 'post' ? `${dto.title}: ` : '') + (content.length > 140 ? `${content.slice(0, 140)}…` : content || 'sent a file');
    const where = ch.kind === 'channel' ? `#${ch.name}` : 'a direct message';
    const url = `/work/${(await this.prisma.workWorkspace.findUnique({ where: { id: ch.workspaceId }, select: { uid: true } }))?.uid}/chat/${ch.uid}${parent ? `?thread=${parent.id}` : ''}`;
    const told = new Set<number>([userId]);
    const tell = async (ids: number[], event: string, title: string) => {
      for (const r of ids) {
        if (told.has(r)) continue;
        told.add(r);
        await this.workNotify.send({ recipientId: r, type: 'CHAT', title, message: snippet, metadata: { event, url, channelUid: ch.uid, messageId: msg.id, actorId: userId, actorName: who, actorAvatar: author.avatarUrl, channelName: ch.name } });
      }
    };
    await tell(valid, 'chat_mention', `${who} mentioned you in ${where}`);
    if (ch.kind !== 'channel') {
      const muted = new Set(ch.members.filter((m) => m.muted).map((m) => m.userId));
      await tell(ch.members.map((m) => m.userId).filter((u) => !muted.has(u)), 'chat_dm', `${who} sent you a message`);
    }
    if (parent) {
      const threadPeople = (await this.prisma.workChatMessage.findMany({ where: { OR: [{ id: parent.id }, { parentId: parent.id }] }, select: { userId: true }, distinct: ['userId'] })).map((x) => x.userId);
      await tell(threadPeople, 'chat_reply', `${who} replied in a thread in ${where}`);
    }
    void ws;
    return shaped;
  }

  private async ownMessage(messageId: number, userId: number) {
    const m = await this.prisma.workChatMessage.findUnique({ where: { id: messageId }, select: { id: true, userId: true, channelId: true, parentId: true, kind: true, deletedAt: true, channel: { select: { uid: true } } } });
    if (!m || m.deletedAt) throw new NotFoundException('Message not found.');
    const ctx = await this.channel(m.channel.uid, userId);
    return { m, ...ctx };
  }

  async edit(messageId: number, userId: number, dto: { content: string; title?: string }) {
    const { m, ch } = await this.ownMessage(messageId, userId);
    if (m.userId !== userId || m.kind === 'system') throw new ForbiddenException('You can only edit your own messages.');
    const content = (dto.content ?? '').trim();
    if (!content) throw new BadRequestException('Write a message.');
    const up = await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { content, editedAt: new Date(), ...(m.kind === 'post' && dto.title?.trim() ? { title: dto.title.trim().slice(0, 200) } : {}) }, select: MSG_SELECT });
    const shaped = this.shape(up, userId);
    this.push(await this.audience(ch), 'message_updated', { channelUid: ch.uid, message: shaped });
    return shaped;
  }

  async remove(messageId: number, userId: number) {
    const { m, ch, ws, me } = await this.ownMessage(messageId, userId);
    if (m.userId !== userId && !(ws.canManage || me?.role === 'owner')) throw new ForbiddenException('You can only delete your own messages.');
    const up = await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date(), pinnedAt: null }, select: MSG_SELECT });
    if (m.parentId) await this.prisma.workChatMessage.update({ where: { id: m.parentId }, data: { replyCount: { decrement: 1 } } }).catch(() => null);
    this.push(await this.audience(ch), 'message_updated', { channelUid: ch.uid, message: this.shape(up, userId) });
    return { deleted: true };
  }

  async react(messageId: number, userId: number, emoji: string) {
    if (!REACTIONS.includes(emoji)) throw new BadRequestException('Unknown reaction.');
    const { ch } = await this.ownMessage(messageId, userId);
    const key = { messageId_userId_emoji: { messageId, userId, emoji } };
    if (await this.prisma.workChatReaction.findUnique({ where: key })) await this.prisma.workChatReaction.delete({ where: key });
    else await this.prisma.workChatReaction.create({ data: { messageId, userId, emoji } });
    const up = await this.prisma.workChatMessage.findUniqueOrThrow({ where: { id: messageId }, select: MSG_SELECT });
    const shaped = this.shape(up, userId);
    this.push(await this.audience(ch), 'message_updated', { channelUid: ch.uid, message: shaped });
    return shaped;
  }

  async pin(messageId: number, userId: number, on: boolean) {
    const { ch, me, ws } = await this.ownMessage(messageId, userId);
    if (!me && !ws.canManage) throw new ForbiddenException('Join the channel first.');
    const up = await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { pinnedAt: on ? new Date() : null }, select: MSG_SELECT });
    const shaped = this.shape(up, userId);
    this.push(await this.audience(ch), 'message_updated', { channelUid: ch.uid, message: shaped, pinned: on });
    return shaped;
  }

  async save(messageId: number, userId: number, on: boolean) {
    await this.ownMessage(messageId, userId);
    if (on) await this.prisma.workChatSaved.upsert({ where: { userId_messageId: { userId, messageId } }, create: { userId, messageId }, update: {} });
    else await this.prisma.workChatSaved.deleteMany({ where: { userId, messageId } });
    return { saved: on };
  }

  async typing(channelUid: string, userId: number) {
    const { ch } = await this.channel(channelUid, userId);
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    this.push((await this.audience(ch)).filter((x) => x !== userId), 'typing', { channelUid: ch.uid, userId, name: u?.firstName ?? '' });
    return { ok: true };
  }

  /* ── drafts, sent, saved, activity ── */

  async setDraft(channelUid: string, userId: number, content: string, parentId = 0) {
    const { ch } = await this.channel(channelUid, userId);
    const text = (content ?? '').slice(0, 20000);
    if (!text.trim()) await this.prisma.workChatDraft.deleteMany({ where: { userId, channelId: ch.id, parentId } });
    else await this.prisma.workChatDraft.upsert({ where: { userId_channelId_parentId: { userId, channelId: ch.id, parentId } }, create: { userId, channelId: ch.id, parentId, content: text }, update: { content: text } });
    return { ok: true };
  }

  async drafts(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    return this.prisma.workChatDraft.findMany({ where: { userId, channel: { workspaceId, archivedAt: null } }, orderBy: { updatedAt: 'desc' }, select: { content: true, parentId: true, updatedAt: true, channel: { select: { uid: true, name: true, kind: true } } } });
  }

  async sent(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChatMessage.findMany({
      where: { userId, kind: { not: 'system' }, deletedAt: null, channel: { workspaceId, archivedAt: null } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { ...MSG_SELECT, channel: { select: { uid: true, name: true, kind: true } } },
    });
    return rows.map((m: any) => ({ ...this.shape(m, userId), channel: m.channel }));
  }

  async saved(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChatSaved.findMany({
      where: { userId, message: { deletedAt: null, channel: { workspaceId, archivedAt: null } } },
      orderBy: { createdAt: 'desc' },
      select: { message: { select: { ...MSG_SELECT, channel: { select: { uid: true, name: true, kind: true } } } } },
    });
    return rows.map((r: any) => ({ ...this.shape(r.message, userId, new Set([r.message.id])), channel: r.message.channel }));
  }

  /** Chat Activity: mentions of me and replies in threads I'm part of */
  async activity(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const myThreads = (await this.prisma.workChatMessage.findMany({ where: { userId, channel: { workspaceId } }, select: { id: true, parentId: true } })).map((m) => m.parentId ?? m.id);
    const rows = await this.prisma.workChatMessage.findMany({
      where: {
        deletedAt: null, userId: { not: userId }, kind: { not: 'system' },
        channel: { workspaceId, archivedAt: null, members: { some: { userId } } },
        OR: [{ mentionIds: { has: userId } }, { parentId: { in: myThreads } }],
      },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { ...MSG_SELECT, channel: { select: { uid: true, name: true, kind: true } } },
    });
    return rows.map((m: any) => ({ ...this.shape(m, userId), channel: m.channel, reason: m.mentionIds.includes(userId) ? 'mention' : 'reply' }));
  }

  /** Posts page: posts from every channel I can see (newest first), optionally by type */
  async posts(workspaceId: number, userId: number, type?: string) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChatMessage.findMany({
      where: {
        kind: 'post', deletedAt: null, parentId: null, ...(type && POST_TYPES.includes(type) ? { postType: type } : {}),
        channel: { workspaceId, archivedAt: null, kind: 'channel', OR: [{ members: { some: { userId } } }, ...(ws.scope === 'all' ? [{ isPrivate: false }] : [])] },
      },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { ...MSG_SELECT, channel: { select: { uid: true, name: true, kind: true } } },
    });
    return rows.map((m: any) => ({ ...this.shape(m, userId), channel: m.channel }));
  }

  /* ── files ── */

  async upload(workspaceId: number, userId: number, files: Express.Multer.File[]) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    if (!files?.length) throw new BadRequestException('No files received.');
    const out: any[] = [];
    for (const f of files.slice(0, 10)) {
      if (!ALLOWED_MIME_TYPES.has(f.mimetype)) throw new BadRequestException(`"${f.originalname}" is not an allowed file type.`);
      const up = await this.storage.upload(f, 'work-chat');
      const file = await this.prisma.file.create({ data: { fileName: up.fileName, mimeType: up.mimeType, fileSize: up.fileSize, storageKey: up.storageKey, url: this.storage.getUrl(up.storageKey), uploadedById: userId } });
      out.push({ id: file.id, name: file.fileName, url: file.url, mime: file.mimeType, size: file.fileSize });
    }
    return out;
  }
}
