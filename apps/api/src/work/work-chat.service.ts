import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import type { StorageProvider } from 'src/storage/storage.types';
import { WorkAccessService } from './work-access.service';
import { ALLOWED_MIME_TYPES } from './work-files.service';
import { WorkNotifyService } from './work-notify.service';
import { WorkRemindersService } from './work-reminders.service';
import { WorkService } from './work.service';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '🔥', '✅', '🚀', '💯', '👏', '😮'];
const POST_TYPES = ['announcement', 'discussion', 'idea', 'update'];
const MSG_SELECT = {
  id: true, channelId: true, parentId: true, kind: true, title: true, postType: true, content: true, mentionIds: true, files: true,
  replyCount: true, lastReplyAt: true, alsoInChannel: true, pinnedAt: true, editedAt: true, deletedAt: true, createdAt: true, assigneeId: true, resolvedAt: true,
  user: { select: USER_MINI },
  reactions: { select: { emoji: true, userId: true } },
  assignee: { select: USER_MINI },
  task: { select: { uid: true, name: true, completedAt: true, list: { select: { uid: true } } } },
  forwarded: true,
} as const;
const uid = () => randomUUID().replace(/-/g, '').slice(0, 12);
const PERMS = ['full', 'edit', 'comment', 'view'];
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
    private readonly work: WorkService,
    private readonly reminders: WorkRemindersService,
  ) {}

  /* ── access ── */

  private async channel(channelUid: string, userId: number, level: 'view' | 'post' | 'pin' | 'manage' = 'view') {
    const ch = await this.prisma.workChannel.findFirst({ where: { uid: channelUid, archivedAt: null }, include: { members: { select: { userId: true, role: true, lastReadAt: true, muted: true, starred: true, permission: true, notify: true, hiddenAt: true } } } });
    if (!ch) throw new NotFoundException('Channel not found.');
    const ws = await this.access.forWorkspace(ch.workspaceId, userId);
    const me = ch.members.find((m) => m.userId === userId);
    // public channels are open to everyone with full Work access; private channels and DMs only to members
    const open = ch.kind === 'channel' && !ch.isPrivate && ws.canView && ws.scope === 'all';
    if (!ws.canView || (!me && !open)) throw new NotFoundException('Channel not found.');
    if (level === 'post' && !(me || open) ) throw new ForbiddenException('Join the channel first.');
    if (level === 'post' && ws.role === 'GUEST' && !me) throw new ForbiddenException('Guests can only post in channels they were added to.');
    if (level === 'post' && me?.permission === 'view') throw new ForbiddenException('You can only view this channel.');
    if (level === 'pin' && !(ws.canManage || ['full', 'edit'].includes(me?.permission ?? ''))) throw new ForbiddenException('You need Edit access to do this.');
    if (level === 'manage' && !(me?.role === 'owner' || me?.permission === 'full' || ws.canManage)) throw new ForbiddenException('Only people with Full edit can do this.');
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
        members: { select: { userId: true, lastReadAt: true, muted: true, starred: true, notify: true, permission: true, hiddenAt: true, sectionId: true, user: { select: USER_MINI } } },
      },
    });
    const out: any[] = [];
    for (const c of rows) {
      const me = c.members.find((m) => m.userId === userId);
      // "Close DM": stays hidden until a newer message arrives
      if (c.kind !== 'channel' && me?.hiddenAt && (!c.lastMessageAt || c.lastMessageAt <= me.hiddenAt)) continue;
      const unread = me
        ? await this.prisma.workChatMessage.count({ where: { channelId: c.id, deletedAt: null, userId: { not: userId }, OR: [{ parentId: null }, { alsoInChannel: true }], ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}) } })
        : 0;
      const mentions = me
        ? await this.prisma.workChatMessage.count({ where: { channelId: c.id, deletedAt: null, mentionIds: { has: userId }, ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}) } })
        : 0;
      out.push({
        id: c.id, uid: c.uid, kind: c.kind, name: c.name, description: c.description, topic: c.topic, isPrivate: c.isPrivate, locationType: c.locationType, locationId: c.locationId,
        lastMessageAt: c.lastMessageAt, joined: !!me, muted: !!me?.muted || me?.notify === 'none', starred: !!me?.starred, notify: me?.notify ?? 'all', permission: me?.permission ?? null, sectionId: me?.sectionId ?? null, unread, mentions,
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
        members: { create: [{ userId, role: 'owner', permission: 'full' }, ...others.map((u) => ({ userId: u }))] },
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
    const rows = await this.prisma.workChannelMember.findMany({ where: { channelId: ch.id }, select: { role: true, permission: true, joinedAt: true, user: { select: USER_MINI } }, orderBy: { joinedAt: 'asc' } });
    const wsRoles = new Map((await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId, userId: { in: rows.map((r) => r.user.id) } }, select: { userId: true, role: true } })).map((m) => [m.userId, m.role]));
    // workspace owners / admins always have full edit
    const members = rows.map((r) => ({ ...r, workRole: wsRoles.get(r.user.id) ?? null, permission: ['OWNER', 'ADMIN'].includes(wsRoles.get(r.user.id) ?? '') ? 'full' : r.permission }));
    const pinned = await this.prisma.workChatMessage.findMany({ where: { channelId: ch.id, pinnedAt: { not: null }, deletedAt: null }, orderBy: { pinnedAt: 'desc' }, select: MSG_SELECT });
    return {
      id: ch.id, uid: ch.uid, kind: ch.kind, name: ch.name, description: ch.description, topic: ch.topic, isPrivate: ch.isPrivate, locationType: ch.locationType, locationId: ch.locationId,
      createdAt: ch.createdAt, joined: !!me, muted: !!me?.muted, starred: !!me?.starred, myRole: me?.role ?? null, notify: me?.notify ?? 'all',
      myPermission: ws.canManage ? 'full' : me?.permission ?? (ch.kind === 'channel' && !ch.isPrivate ? 'edit' : null),
      canManage: me?.role === 'owner' || me?.permission === 'full' || ws.canManage, canPost: ws.canManage || !me || me.permission !== 'view', members, pinned,
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

  async setPrefs(channelUid: string, userId: number, dto: { muted?: boolean; starred?: boolean; notify?: string }) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (!me) throw new BadRequestException('Join the channel first.');
    if (dto.notify && !['all', 'mentions', 'none'].includes(dto.notify)) throw new BadRequestException('Unknown notification setting.');
    await this.prisma.workChannelMember.update({
      where: { channelId_userId: { channelId: ch.id, userId } },
      data: { ...(dto.muted !== undefined && { muted: dto.muted }), ...(dto.starred !== undefined && { starred: dto.starred }), ...(dto.notify && { notify: dto.notify, muted: dto.notify === 'none' }) },
    });
    return { ok: true };
  }

  /** "Mark as unread": everything after the latest message from someone else is unread again */
  async markUnread(channelUid: string, userId: number) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (!me) throw new BadRequestException('Join the channel first.');
    const last = await this.prisma.workChatMessage.findFirst({ where: { channelId: ch.id, userId: { not: userId }, deletedAt: null, kind: { not: 'system' } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    await this.prisma.workChannelMember.update({ where: { channelId_userId: { channelId: ch.id, userId } }, data: { lastReadAt: last ? new Date(last.createdAt.getTime() - 1) : null } });
    return { ok: true };
  }

  /** "Mark all as read" for the Channels or the Direct Messages section */
  async markAllRead(workspaceId: number, userId: number, section: 'channels' | 'dms' | number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    await this.prisma.workChannelMember.updateMany({
      where: typeof section === 'number'
        ? { userId, sectionId: section, channel: { workspaceId, archivedAt: null } }
        : { userId, sectionId: null, channel: { workspaceId, archivedAt: null, kind: section === 'channels' ? 'channel' : { in: ['dm', 'group'] } } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  /** "Close DM": hide it from the sidebar until a new message arrives */
  async closeDm(channelUid: string, userId: number) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (ch.kind === 'channel' || !me) throw new BadRequestException('Only direct messages can be closed.');
    await this.prisma.workChannelMember.update({ where: { channelId_userId: { channelId: ch.id, userId } }, data: { hiddenAt: new Date(), lastReadAt: new Date() } });
    return { ok: true };
  }

  // ---------- scheduled messages (written now, sent later) ----------

  private scheduledSelect = {
    id: true, parentId: true, content: true, mentionIds: true, files: true, sendAt: true, status: true, error: true, messageId: true, sentAt: true, createdAt: true,
    channel: { select: { uid: true, kind: true, name: true, isPrivate: true, members: { select: { userId: true, user: { select: USER_MINI } } } } },
  } as const;
  private shapeScheduled(r: any, userId: number) {
    const { channel: c, ...rest } = r;
    return { ...rest, files: Array.isArray(r.files) ? r.files : [], channel: { uid: c.uid, kind: c.kind, name: c.name, isPrivate: c.isPrivate, people: c.kind === 'channel' ? [] : c.members.filter((m: any) => m.userId !== userId).map((m: any) => m.user) } };
  }
  private checkSendAt(v: string | Date) {
    const at = new Date(v);
    if (isNaN(+at)) throw new BadRequestException('Pick a date and time.');
    if (+at < Date.now() + 55_000) throw new BadRequestException('Pick a time at least a minute from now.');
    if (+at > Date.now() + 366 * 86_400_000) throw new BadRequestException('Schedule up to a year ahead.');
    return at;
  }

  async schedule(channelUid: string, userId: number, dto: { content?: string; parentId?: number; mentionIds?: number[]; files?: any[]; sendAt: string }) {
    const { ch } = await this.channel(channelUid, userId, 'post');
    const content = (dto.content ?? '').trim();
    const files = await this.ownFiles(userId, dto.files);
    if (!content && !files.length) throw new BadRequestException('Write a message.');
    if (content.length > 20000) throw new BadRequestException('That message is too long.');
    const sendAt = this.checkSendAt(dto.sendAt);
    if (dto.parentId) {
      const parent = await this.prisma.workChatMessage.findFirst({ where: { id: dto.parentId, channelId: ch.id, deletedAt: null, parentId: null }, select: { id: true } });
      if (!parent) throw new BadRequestException('Reply to a message in this channel.');
    }
    if ((await this.prisma.workChatScheduled.count({ where: { userId, status: { in: ['pending', 'failed'] } } })) >= 100) throw new BadRequestException('You have 100 scheduled messages already.');
    const row = await this.prisma.workChatScheduled.create({
      data: { channelId: ch.id, userId, parentId: dto.parentId ?? null, content, mentionIds: [...new Set(dto.mentionIds ?? [])], files, sendAt },
      select: this.scheduledSelect,
    });
    this.push([userId], 'scheduled', { channelUid: ch.uid });
    return this.shapeScheduled(row, userId);
  }

  /** my scheduled messages in a workspace (waiting, or failed and needing attention) */
  async scheduledList(workspaceId: number, userId: number, channelUid?: string) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChatScheduled.findMany({
      where: { userId, status: { in: ['pending', 'sending', 'failed'] }, channel: { workspaceId, archivedAt: null, ...(channelUid ? { uid: channelUid } : {}) } },
      orderBy: { sendAt: 'asc' }, select: this.scheduledSelect,
    });
    return rows.map((r) => this.shapeScheduled(r, userId));
  }

  private async myScheduled(id: number, userId: number) {
    const r = await this.prisma.workChatScheduled.findUnique({ where: { id }, select: { id: true, userId: true, status: true, channel: { select: { uid: true } } } });
    if (!r || r.userId !== userId) throw new NotFoundException('Scheduled message not found.');
    return r;
  }

  async updateScheduled(id: number, userId: number, dto: { content?: string; sendAt?: string }) {
    const r = await this.myScheduled(id, userId);
    if (!['pending', 'failed'].includes(r.status)) throw new BadRequestException('This message was already sent.');
    const content = dto.content?.trim();
    if (dto.content !== undefined && (!content || content.length > 20000)) throw new BadRequestException('Write a message (up to 20,000 characters).');
    const row = await this.prisma.workChatScheduled.update({
      where: { id },
      // editing a failed message puts it back in the queue
      data: { ...(content && { content }), ...(dto.sendAt && { sendAt: this.checkSendAt(dto.sendAt) }), status: 'pending', error: null },
      select: this.scheduledSelect,
    });
    this.push([userId], 'scheduled', { channelUid: r.channel.uid });
    return this.shapeScheduled(row, userId);
  }

  async deleteScheduled(id: number, userId: number) {
    const r = await this.myScheduled(id, userId);
    if (r.status === 'sending') throw new BadRequestException('This message is being sent right now.');
    if (r.status === 'sent') throw new BadRequestException('This message was already sent.');
    await this.prisma.workChatScheduled.delete({ where: { id } });
    this.push([userId], 'scheduled', { channelUid: r.channel.uid });
    return { ok: true };
  }

  async sendScheduledNow(id: number, userId: number) {
    await this.myScheduled(id, userId);
    const out = await this.deliverScheduled(id);
    if (out.status === 'skipped') throw new BadRequestException('This message was already sent, or is being sent right now.');
    if (out.status === 'failed') throw new BadRequestException(out.error ?? 'Could not send.');
    return out;
  }

  /**
   * Send one scheduled message as its author. Claims the row first so it is sent once, even if two
   * workers run. Permissions are checked again at send time (the author may have lost access).
   */
  async deliverScheduled(id: number): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string; messageId?: number }> {
    const claimed = await this.prisma.workChatScheduled.updateMany({ where: { id, status: { in: ['pending', 'failed'] } }, data: { status: 'sending' } });
    if (!claimed.count) return { status: 'skipped' };
    const r = await this.prisma.workChatScheduled.findUniqueOrThrow({ where: { id }, select: { id: true, userId: true, parentId: true, content: true, mentionIds: true, files: true, channel: { select: { uid: true, name: true, kind: true, workspaceId: true, archivedAt: true } } } });
    try {
      if (r.channel.archivedAt) throw new BadRequestException('The channel was deleted.');
      const m = await this.send(r.channel.uid, r.userId, { content: r.content, parentId: r.parentId ?? undefined, mentionIds: r.mentionIds, files: Array.isArray(r.files) ? (r.files as any[]) : [] });
      await this.prisma.workChatScheduled.update({ where: { id }, data: { status: 'sent', sentAt: new Date(), messageId: m.id, error: null } });
      this.push([r.userId], 'scheduled', { channelUid: r.channel.uid });
      return { status: 'sent', messageId: m.id };
    } catch (e: any) {
      const error = (e?.response?.message ?? e?.message ?? 'Could not send.').toString().slice(0, 300);
      await this.prisma.workChatScheduled.update({ where: { id }, data: { status: 'failed', error } });
      this.push([r.userId], 'scheduled', { channelUid: r.channel.uid });
      const ws = await this.prisma.workWorkspace.findUnique({ where: { id: r.channel.workspaceId }, select: { uid: true } });
      await this.workNotify.send({
        recipientId: r.userId, type: 'CHAT', title: `Your scheduled message to ${r.channel.kind === 'channel' ? `#${r.channel.name}` : 'a direct message'} wasn't sent`,
        message: error, metadata: { event: 'chat_scheduled_failed', url: `/work/${ws?.uid}/chat/drafts?tab=scheduled`, channelUid: r.channel.uid },
      }).catch(() => {});
      return { status: 'failed', error };
    }
  }

  /** every minute: send what is due; anything stuck "sending" for 10 minutes is marked failed (never sent twice) */
  @Cron('* * * * *')
  async sendDueScheduled() {
    if (this.scheduling) return;
    this.scheduling = true;
    try {
      await this.prisma.workChatScheduled.updateMany({ where: { status: 'sending', updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { status: 'failed', error: 'Sending was interrupted. Check the channel, then send it again.' } });
      const due = await this.prisma.workChatScheduled.findMany({ where: { status: 'pending', sendAt: { lte: new Date() } }, orderBy: { sendAt: 'asc' }, take: 200, select: { id: true } });
      for (const d of due) await this.deliverScheduled(d.id).catch(() => {});
    } finally {
      this.scheduling = false;
    }
  }
  private scheduling = false;

  // ---------- Bookmarks: links pinned to the top of a channel ----------

  /** only web links, or links to Work's own pages — never javascript:, data: and the like */
  private cleanUrl(raw: string) {
    const v = (raw ?? '').trim();
    if (!v || v.length > 2000) throw new BadRequestException('Add a link (up to 2,000 characters).');
    if (/^\/work\/[^\s]*$/.test(v)) return v;
    let u: URL;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`); } catch { throw new BadRequestException('That link is not valid.'); }
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new BadRequestException('Use a web link (http or https).');
    return u.toString();
  }
  private bookmarkTitle(title: string | undefined, url: string) {
    const t = (title ?? '').trim();
    if (t.length > 80) throw new BadRequestException('Keep the title under 80 characters.');
    if (t) return t;
    return url.startsWith('/work/') ? 'Work link' : new URL(url).hostname.replace(/^www\./, '');
  }
  private bookmarkRows(channelId: number) {
    return this.prisma.workChannelBookmark.findMany({ where: { channelId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, title: true, url: true, position: true, createdAt: true, createdBy: { select: USER_MINI } } });
  }

  async bookmarks(channelUid: string, userId: number) {
    const { ch } = await this.channel(channelUid, userId);
    return this.bookmarkRows(ch.id);
  }

  async addBookmark(channelUid: string, userId: number, dto: { url: string; title?: string }) {
    const { ch } = await this.channel(channelUid, userId, 'pin');
    if ((await this.prisma.workChannelBookmark.count({ where: { channelId: ch.id } })) >= 30) throw new BadRequestException('A channel can have up to 30 bookmarks.');
    const url = this.cleanUrl(dto.url);
    const last = await this.prisma.workChannelBookmark.findFirst({ where: { channelId: ch.id }, orderBy: { position: 'desc' }, select: { position: true } });
    const b = await this.prisma.workChannelBookmark.create({ data: { channelId: ch.id, url, title: this.bookmarkTitle(dto.title, url), position: (last?.position ?? -1) + 1, createdById: userId }, select: { id: true } });
    this.push(await this.audience(ch), 'bookmarks', { channelUid: ch.uid });
    return (await this.bookmarkRows(ch.id)).find((x) => x.id === b.id);
  }

  private async bookmarkFor(id: number, userId: number) {
    const b = await this.prisma.workChannelBookmark.findUnique({ where: { id }, select: { id: true, url: true, channel: { select: { uid: true } } } });
    if (!b) throw new NotFoundException('Bookmark not found.');
    const { ch } = await this.channel(b.channel.uid, userId, 'pin');
    return { b, ch };
  }

  async updateBookmark(id: number, userId: number, dto: { url?: string; title?: string }) {
    const { b, ch } = await this.bookmarkFor(id, userId);
    const url = dto.url !== undefined ? this.cleanUrl(dto.url) : b.url;
    await this.prisma.workChannelBookmark.update({ where: { id }, data: { url, ...(dto.title !== undefined && { title: this.bookmarkTitle(dto.title, url) }) } });
    this.push(await this.audience(ch), 'bookmarks', { channelUid: ch.uid });
    return (await this.bookmarkRows(ch.id)).find((x) => x.id === id);
  }

  async deleteBookmark(id: number, userId: number) {
    const { ch } = await this.bookmarkFor(id, userId);
    await this.prisma.workChannelBookmark.delete({ where: { id } });
    this.push(await this.audience(ch), 'bookmarks', { channelUid: ch.uid });
    return { ok: true };
  }

  async reorderBookmarks(channelUid: string, userId: number, ids: number[]) {
    const { ch } = await this.channel(channelUid, userId, 'pin');
    const have = new Set((await this.prisma.workChannelBookmark.findMany({ where: { channelId: ch.id }, select: { id: true } })).map((x) => x.id));
    const order = [...new Set(ids)];
    if (order.length !== have.size || order.some((i) => !have.has(i))) throw new BadRequestException('Send every bookmark of this channel, once.');
    await this.prisma.$transaction(order.map((bid, position) => this.prisma.workChannelBookmark.update({ where: { id: bid }, data: { position } })));
    this.push(await this.audience(ch), 'bookmarks', { channelUid: ch.uid });
    return this.bookmarkRows(ch.id);
  }

  // ---------- Channel Views: List / Board / Doc tabs next to Chat ----------

  private async viewRows(channelId: number, userId: number) {
    const rows = await this.prisma.workChannelView.findMany({
      where: { channelId }, orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, kind: true, name: true, content: true, position: true, listId: true, updatedAt: true, updatedBy: { select: USER_MINI }, list: { select: { id: true, uid: true, name: true, archivedAt: true } } },
    });
    const out: any[] = [];
    for (const v of rows) {
      let list: { id: number; uid: string; name: string } | null = null;
      let locked = false;
      if (v.kind !== 'doc') {
        // the list keeps its own permissions: people without access only see a locked tab
        try { if (v.list && !v.list.archivedAt) { await this.access.requireList(v.list.id, userId, 'view'); list = { id: v.list.id, uid: v.list.uid, name: v.list.name }; } else locked = true; } catch { locked = true; }
      }
      out.push({ id: v.id, kind: v.kind, name: v.name, position: v.position, list, locked, content: v.kind === 'doc' ? v.content : undefined, updatedAt: v.updatedAt, updatedBy: v.updatedBy });
    }
    return out;
  }

  async views(channelUid: string, userId: number) {
    const { ch } = await this.channel(channelUid, userId);
    return this.viewRows(ch.id, userId);
  }

  async addView(channelUid: string, userId: number, dto: { kind: string; name?: string; listId?: number }) {
    const { ch } = await this.channel(channelUid, userId, 'pin');
    if (!['list', 'board', 'doc'].includes(dto.kind)) throw new BadRequestException('Pick List, Board or Doc.');
    if ((await this.prisma.workChannelView.count({ where: { channelId: ch.id } })) >= 20) throw new BadRequestException('A channel can have up to 20 views.');
    let name = (dto.name ?? '').trim();
    let listId: number | null = null;
    if (dto.kind !== 'doc') {
      if (!dto.listId) throw new BadRequestException('Pick a list.');
      await this.access.requireList(dto.listId, userId, 'view');
      const l = await this.prisma.workList.findUniqueOrThrow({ where: { id: dto.listId }, select: { id: true, name: true, space: { select: { workspaceId: true } } } });
      if (l.space.workspaceId !== ch.workspaceId) throw new BadRequestException('Pick a list in this workspace.');
      listId = l.id;
      name ||= l.name;
    }
    name ||= 'Doc';
    if (name.length > 60) throw new BadRequestException('Keep the view name under 60 characters.');
    const last = await this.prisma.workChannelView.findFirst({ where: { channelId: ch.id }, orderBy: { position: 'desc' }, select: { position: true } });
    const v = await this.prisma.workChannelView.create({ data: { channelId: ch.id, kind: dto.kind, name, listId, position: (last?.position ?? -1) + 1, updatedById: userId } });
    this.push(await this.audience(ch), 'views', { channelUid: ch.uid });
    return (await this.viewRows(ch.id, userId)).find((x) => x.id === v.id);
  }

  private async viewFor(id: number, userId: number) {
    const v = await this.prisma.workChannelView.findUnique({ where: { id }, select: { id: true, kind: true, channel: { select: { uid: true } } } });
    if (!v) throw new NotFoundException('View not found.');
    // 404 for people who can't see the channel, 403 for those who can but lack Edit access
    const { ch } = await this.channel(v.channel.uid, userId, 'pin');
    return { v, ch };
  }

  async updateView(id: number, userId: number, dto: { name?: string; content?: string }) {
    const { v, ch } = await this.viewFor(id, userId);
    const name = dto.name?.trim();
    if (dto.name !== undefined && (!name || name.length > 60)) throw new BadRequestException('Name the view (up to 60 characters).');
    if (dto.content !== undefined && v.kind !== 'doc') throw new BadRequestException('Only docs have content.');
    if ((dto.content?.length ?? 0) > 100_000) throw new BadRequestException('The doc is too long.');
    await this.prisma.workChannelView.update({ where: { id }, data: { ...(name && { name }), ...(dto.content !== undefined && { content: dto.content }), updatedById: userId } });
    this.push(await this.audience(ch), 'views', { channelUid: ch.uid, viewId: id });
    return (await this.viewRows(ch.id, userId)).find((x) => x.id === id);
  }

  async deleteView(id: number, userId: number) {
    const { ch } = await this.viewFor(id, userId);
    await this.prisma.workChannelView.delete({ where: { id } });
    this.push(await this.audience(ch), 'views', { channelUid: ch.uid });
    return { ok: true };
  }

  async reorderViews(channelUid: string, userId: number, ids: number[]) {
    const { ch } = await this.channel(channelUid, userId, 'pin');
    const have = new Set((await this.prisma.workChannelView.findMany({ where: { channelId: ch.id }, select: { id: true } })).map((x) => x.id));
    const order = [...new Set(ids)];
    if (order.length !== have.size || order.some((i) => !have.has(i))) throw new BadRequestException('Send every view of this channel, once.');
    await this.prisma.$transaction(order.map((vid, position) => this.prisma.workChannelView.update({ where: { id: vid }, data: { position } })));
    this.push(await this.audience(ch), 'views', { channelUid: ch.uid });
    return this.viewRows(ch.id, userId);
  }

  // ---------- the person's own sidebar sections ----------

  async sections(workspaceId: number, userId: number) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    return this.prisma.workChatSection.findMany({ where: { workspaceId, userId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, name: true, position: true } });
  }

  async createSection(workspaceId: number, userId: number, name: string) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const n = (name ?? '').trim();
    if (!n || n.length > 60) throw new BadRequestException('Name the section (up to 60 characters).');
    const count = await this.prisma.workChatSection.count({ where: { workspaceId, userId } });
    if (count >= 30) throw new BadRequestException('You can have up to 30 sections.');
    const last = await this.prisma.workChatSection.findFirst({ where: { workspaceId, userId }, orderBy: { position: 'desc' }, select: { position: true } });
    return this.prisma.workChatSection.create({ data: { workspaceId, userId, name: n, position: (last?.position ?? -1) + 1 }, select: { id: true, name: true, position: true } });
  }

  private async mySection(id: number, userId: number) {
    const s = await this.prisma.workChatSection.findUnique({ where: { id } });
    if (!s || s.userId !== userId) throw new NotFoundException('Section not found.');
    return s;
  }

  async renameSection(id: number, userId: number, name: string) {
    await this.mySection(id, userId);
    const n = (name ?? '').trim();
    if (!n || n.length > 60) throw new BadRequestException('Name the section (up to 60 characters).');
    return this.prisma.workChatSection.update({ where: { id }, data: { name: n }, select: { id: true, name: true, position: true } });
  }

  /** conversations in it go back to Channels / Direct Messages */
  async deleteSection(id: number, userId: number) {
    await this.mySection(id, userId);
    await this.prisma.workChatSection.delete({ where: { id } });
    return { ok: true };
  }

  async reorderSections(workspaceId: number, userId: number, ids: number[]) {
    const mine = await this.sections(workspaceId, userId);
    const set = new Set(mine.map((s) => s.id));
    const order = [...new Set(ids)];
    if (order.length !== set.size || order.some((i) => !set.has(i))) throw new BadRequestException('Send every one of your sections, once.');
    await this.prisma.$transaction(order.map((id, position) => this.prisma.workChatSection.update({ where: { id }, data: { position } })));
    return this.sections(workspaceId, userId);
  }

  /** "Move to": put a conversation in one of your sections (null = back to the default) */
  async moveToSection(channelUid: string, userId: number, sectionId: number | null) {
    const { ch, me } = await this.channel(channelUid, userId);
    if (!me) throw new BadRequestException('Join the channel first.');
    if (sectionId !== null) {
      const s = await this.mySection(sectionId, userId);
      if (s.workspaceId !== ch.workspaceId) throw new BadRequestException('That section is in another workspace.');
    }
    await this.prisma.workChannelMember.update({ where: { channelId_userId: { channelId: ch.id, userId } }, data: { sectionId } });
    return { ok: true };
  }

  /** Sharing & Permissions: one person's access in this channel */
  async setPermission(channelUid: string, userId: number, target: number, permission: string) {
    const { ch } = await this.channel(channelUid, userId, 'manage');
    if (!PERMS.includes(permission)) throw new BadRequestException('Unknown permission.');
    if (ch.kind !== 'channel') throw new BadRequestException('Direct messages have no permissions.');
    const role = (await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: ch.workspaceId, userId: target } }, select: { role: true } }))?.role;
    if (role === 'OWNER' || role === 'ADMIN') throw new BadRequestException('Workspace owners and admins always have full edit.');
    if (target === userId && permission !== 'full') throw new BadRequestException("You can't lower your own access.");
    const r = await this.prisma.workChannelMember.updateMany({ where: { channelId: ch.id, userId: target }, data: { permission } });
    if (!r.count) throw new NotFoundException('That person is not in this channel.');
    this.push([target], 'channel', { channelUid: ch.uid });
    return { ok: true };
  }

  /** "Edit all": the same access for everyone (except owners / admins and you) */
  async setAllPermissions(channelUid: string, userId: number, permission: string) {
    const { ch } = await this.channel(channelUid, userId, 'manage');
    if (!PERMS.includes(permission)) throw new BadRequestException('Unknown permission.');
    const keep = (await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId, role: { in: ['OWNER', 'ADMIN'] } }, select: { userId: true } })).map((m) => m.userId);
    await this.prisma.workChannelMember.updateMany({ where: { channelId: ch.id, userId: { notIn: [...keep, userId] } }, data: { permission } });
    this.push(await this.audience(ch), 'channel', { channelUid: ch.uid });
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

  /**
   * Global chat search across every channel / DM the person can see (never private ones they're not in).
   * Filters: from (author), in (channel uid), after / before (dates), has (link | file | task), mentions (me), kind (post).
   */
  async search(workspaceId: number, userId: number, o: { q?: string; from?: number; in?: string; after?: string; before?: string; has?: string; mentions?: boolean; kind?: string; cursor?: string }) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const q = (o.q ?? '').trim().slice(0, 200);
    const filtered = !!(o.from || o.in || o.after || o.before || o.has || o.mentions || o.kind);
    if (q.length < 2 && !filtered) return { items: [], channels: [], hasMore: false, nextCursor: null };
    const visible = await this.prisma.workChannel.findMany({
      where: { workspaceId, archivedAt: null, OR: [{ members: { some: { userId } } }, ...(ws.scope === 'all' ? [{ kind: 'channel', isPrivate: false }] : [])] },
      select: { id: true, uid: true, kind: true, name: true, isPrivate: true, members: { select: { userId: true, hiddenAt: true, user: { select: USER_MINI } } } },
    });
    const byId = new Map(visible.map((c) => [c.id, c]));
    let ids = visible.map((c) => c.id);
    if (o.in) ids = visible.filter((c) => c.uid === o.in).map((c) => c.id);
    const date = (s?: string) => { const d = s ? new Date(s) : null; return d && !isNaN(+d) ? d : null; };
    const after = date(o.after), before = date(o.before), cursor = date(o.cursor);
    const AND: Prisma.WorkChatMessageWhereInput[] = [
      { channelId: { in: ids } }, { deletedAt: null }, { kind: { not: 'system' } },
      ...(q.length >= 2 ? [{ OR: [{ content: { contains: q, mode: 'insensitive' as const } }, { title: { contains: q, mode: 'insensitive' as const } }] }] : []),
      ...(o.from ? [{ userId: o.from }] : []),
      ...(after ? [{ createdAt: { gte: after } }] : []),
      ...(before ? [{ createdAt: { lt: before } }] : []),
      ...(cursor ? [{ createdAt: { lt: cursor } }] : []),
      ...(o.mentions ? [{ mentionIds: { has: userId } }] : []),
      ...(o.kind === 'post' ? [{ kind: 'post' }] : []),
      ...(o.has === 'link' ? [{ content: { contains: 'http', mode: 'insensitive' as const } }] : []),
      ...(o.has === 'task' ? [{ taskId: { not: null } }] : []),
      ...(o.has === 'file' ? [{ NOT: [{ files: { equals: Prisma.AnyNull } }, { files: { equals: [] } }] }] : []),
    ];
    const take = 30;
    const rows = ids.length ? await this.prisma.workChatMessage.findMany({ where: { AND }, orderBy: { createdAt: 'desc' }, take: take + 1, select: MSG_SELECT }) : [];
    const page = rows.slice(0, take);
    const saved = new Set((await this.prisma.workChatSaved.findMany({ where: { userId, messageId: { in: page.map((r) => r.id) } }, select: { messageId: true } })).map((s) => s.messageId));
    const where = (cid: number) => {
      const c = byId.get(cid)!;
      return { uid: c.uid, kind: c.kind, name: c.name, isPrivate: c.isPrivate, people: c.kind === 'channel' ? [] : c.members.filter((m) => m.userId !== userId).map((m) => m.user) };
    };
    // channels whose name matches (only on the first page)
    const channels = !cursor && q.length >= 2
      ? visible.filter((c) => c.kind === 'channel' && (c.name ?? '').includes(q.toLowerCase().replace(/^#/, ''))).slice(0, 8).map((c) => ({ ...where(c.id), joined: c.members.some((m) => m.userId === userId), memberCount: c.members.length }))
      : [];
    return {
      items: page.map((m) => ({ ...this.shape(m, userId, saved), channel: where(m.channelId) })),
      channels,
      hasMore: rows.length > take,
      nextCursor: rows.length > take ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
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

  async send(channelUid: string, userId: number, dto: { content?: string; parentId?: number; kind?: string; title?: string; postType?: string; mentionIds?: number[]; files?: any[]; alsoInChannel?: boolean; forwarded?: Record<string, unknown> }) {
    const { ch, me, ws } = await this.channel(channelUid, userId, 'post');
    const content = (dto.content ?? '').trim();
    const files = await this.ownFiles(userId, dto.files);
    if (!content && !files.length && !dto.forwarded) throw new BadRequestException('Write a message.');
    if (content.length > 20000) throw new BadRequestException('That message is too long.');
    const kind = dto.kind === 'post' ? 'post' : 'message';
    if (kind === 'post' && (!dto.title?.trim() || (dto.postType && !POST_TYPES.includes(dto.postType)))) throw new BadRequestException('Posts need a title.');
    if (kind === 'post' && me && !ws.canManage && !['full', 'edit'].includes(me.permission)) throw new ForbiddenException('You need Edit access to write posts.');
    let parent: { id: number; userId: number; parentId: number | null } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.workChatMessage.findFirst({ where: { id: dto.parentId, channelId: ch.id, deletedAt: null }, select: { id: true, userId: true, parentId: true } });
      if (!parent || parent.parentId) throw new BadRequestException('Reply to a message in this channel.');
    }
    const mentions = [...new Set(dto.mentionIds ?? [])].filter((u) => u !== userId);
    const valid = mentions.length ? (await this.prisma.workMember.findMany({ where: { workspaceId: ch.workspaceId, userId: { in: mentions } }, select: { userId: true } })).map((m) => m.userId) : [];
    // posting in an open channel you haven't joined joins you (like ClickUp)
    if (!me && ch.kind === 'channel') await this.prisma.workChannelMember.create({ data: { channelId: ch.id, userId, lastReadAt: new Date() } });
    const now = new Date();
    const msg = await this.prisma.workChatMessage.create({
      data: {
        channelId: ch.id, userId, parentId: parent?.id ?? null, kind, title: kind === 'post' ? dto.title!.trim().slice(0, 200) : null, postType: kind === 'post' ? dto.postType ?? 'announcement' : null,
        content, mentionIds: valid, files, alsoInChannel: !!(parent && dto.alsoInChannel), ...(dto.forwarded ? { forwarded: dto.forwarded as any } : {}),
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
    const level = new Map(ch.members.map((m) => [m.userId, m.notify]));
    const tell = async (ids: number[], event: string, title: string) => {
      for (const r of ids) {
        if (told.has(r)) continue;
        // per-person setting: nothing at all, or mentions only
        if (level.get(r) === 'none' || (level.get(r) === 'mentions' && event !== 'chat_mention')) continue;
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

  private async msgUrl(workspaceId: number, channelUid: string, m: { id: number; parentId: number | null }) {
    const ws = await this.prisma.workWorkspace.findUnique({ where: { id: workspaceId }, select: { uid: true } });
    return `/work/${ws?.uid}/chat/${channelUid}?${m.parentId ? `thread=${m.parentId}&` : ''}message=${m.id}`;
  }
  private async full(messageId: number) {
    return this.prisma.workChatMessage.findUniqueOrThrow({ where: { id: messageId }, select: { id: true, parentId: true, kind: true, title: true, content: true, taskId: true, assigneeId: true, userId: true, createdAt: true, user: { select: USER_MINI } } });
  }
  private async updated(ch: { id: number; uid: string; kind: string; isPrivate: boolean; workspaceId: number }, messageId: number, userId: number) {
    const up = await this.prisma.workChatMessage.findUniqueOrThrow({ where: { id: messageId }, select: MSG_SELECT });
    const shaped = this.shape(up, userId);
    this.push(await this.audience(ch), 'message_updated', { channelUid: ch.uid, message: shaped });
    return shaped;
  }

  /** "Create task" from a message: the text becomes the description with a link back here */
  async toTask(messageId: number, userId: number, dto: { listId: number; name?: string }) {
    const { m, ch } = await this.ownMessage(messageId, userId);
    const f = await this.full(messageId);
    if (f.kind === 'system') throw new BadRequestException('System messages cannot become tasks.');
    if (f.taskId) throw new BadRequestException('A task was already created from this message.');
    const who = `${f.user.firstName} ${f.user.lastName}`.trim();
    const link = `${process.env.FRONTEND_URL ?? ''}${await this.msgUrl(ch.workspaceId, ch.uid, m)}`;
    const name = (dto.name?.trim() || f.title || f.content.split('\n')[0] || 'Task from chat').slice(0, 200);
    // check the list's workspace before creating anything
    const target = await this.prisma.workList.findFirst({ where: { id: dto.listId, archivedAt: null }, select: { space: { select: { workspaceId: true } } } });
    if (!target) throw new NotFoundException('List not found.');
    if (target.space.workspaceId !== ch.workspaceId) throw new BadRequestException('Pick a list in this workspace.');
    const task = await this.work.createTask(dto.listId, userId, { name, description: `${f.content}\n\n— From a chat message by ${who}: ${link}` } as any);
    const t = await this.prisma.workTask.findUniqueOrThrow({ where: { id: (task as any).id }, select: { id: true, uid: true, name: true, list: { select: { uid: true } } } });
    await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { taskId: t.id } });
    await this.updated(ch, messageId, userId);
    return { uid: t.uid, name: t.name, listUid: t.list.uid };
  }

  /** assign a message to someone (ClickUp "Assign") — it shows in their Inbox and Assigned Comments */
  async assign(messageId: number, userId: number, assigneeId: number | null) {
    const { m, ch, me, ws } = await this.ownMessage(messageId, userId);
    if (!ws.canManage && (!me || me.permission === 'view')) throw new ForbiddenException('You can only view this channel.');
    if (assigneeId !== null && !(await this.access.areMembers(ch.workspaceId, [assigneeId]))) throw new BadRequestException('Messages can only be assigned to Work members.');
    if (assigneeId !== null && ch.kind !== 'channel' && !ch.members.some((x) => x.userId === assigneeId)) throw new BadRequestException('Assign to someone in this conversation.');
    await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { assigneeId, assignedById: assigneeId ? userId : null, resolvedAt: null } });
    if (assigneeId && assigneeId !== userId) {
      const f = await this.full(messageId);
      const me2 = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, avatarUrl: true } });
      await this.workNotify.send({
        recipientId: assigneeId, type: 'CHAT', title: `${`${me2?.firstName ?? ''} ${me2?.lastName ?? ''}`.trim()} assigned you a message`, message: f.content.slice(0, 140) || 'a message',
        metadata: { event: 'assigned_comment', chat: true, url: await this.msgUrl(ch.workspaceId, ch.uid, m), channelUid: ch.uid, messageId, actorId: userId, actorName: `${me2?.firstName ?? ''} ${me2?.lastName ?? ''}`.trim(), actorAvatar: me2?.avatarUrl ?? null },
      });
    }
    return this.updated(ch, messageId, userId);
  }

  async resolve(messageId: number, userId: number, resolved: boolean) {
    const { ch, ws } = await this.ownMessage(messageId, userId);
    const f = await this.full(messageId);
    if (!f.assigneeId) throw new BadRequestException('This message is not assigned.');
    if (![f.assigneeId, f.userId].includes(userId) && !ws.canManage) throw new ForbiddenException('Only the assignee, the author or an admin can resolve it.');
    await this.prisma.workChatMessage.update({ where: { id: messageId }, data: { resolvedAt: resolved ? new Date() : null } });
    return this.updated(ch, messageId, userId);
  }

  /** messages assigned to me (Assigned Comments page) */
  async assignedToMe(workspaceId: number, userId: number, resolved: boolean) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workChatMessage.findMany({
      where: { assigneeId: userId, deletedAt: null, resolvedAt: resolved ? { not: null } : null, channel: { workspaceId, archivedAt: null, members: { some: { userId } } } },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { ...MSG_SELECT, channel: { select: { uid: true, name: true, kind: true } } },
    });
    return rows.map((r: any) => ({ ...this.shape(r, userId), channel: r.channel }));
  }

  /** "Remind me" about a message: it comes back to my Inbox at that time */
  async remind(messageId: number, userId: number, remindAt: string) {
    const { m, ch } = await this.ownMessage(messageId, userId);
    const f = await this.full(messageId);
    const who = `${f.user.firstName} ${f.user.lastName}`.trim();
    const snippet = f.content.length > 80 ? `${f.content.slice(0, 80)}…` : f.content || 'a message';
    return this.reminders.create(ch.workspaceId, userId, { title: `Message from ${who}: ${snippet}`, remindAt, url: await this.msgUrl(ch.workspaceId, ch.uid, m) });
  }

  /** forward a message to another channel / DM (with an optional note) */
  async forward(messageId: number, userId: number, targetUid: string, note?: string) {
    const { ch } = await this.ownMessage(messageId, userId);
    const f = await this.full(messageId);
    if (f.kind === 'system') throw new BadRequestException('System messages cannot be forwarded.');
    return this.send(targetUid, userId, {
      content: note?.trim() ?? '',
      forwarded: {
        messageId: f.id, authorName: `${f.user.firstName} ${f.user.lastName}`.trim(), authorAvatar: f.user.avatarUrl,
        channelUid: ch.uid, channelName: ch.kind === 'channel' ? ch.name : null, title: f.title, content: f.content.slice(0, 4000), createdAt: f.createdAt,
      },
    });
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
    if (!ws.canManage && !['full', 'edit'].includes(me?.permission ?? '')) throw new ForbiddenException('You need Edit access to pin.');
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

  /**
   * Files on a message must be ones this person uploaded through Work chat. Only the ids are trusted:
   * name, url, type and size always come from the database, never from the browser.
   */
  private async ownFiles(userId: number, raw: any[] | undefined) {
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > 10) throw new BadRequestException('Up to 10 files per message.');
    const ids = [...new Set(list.map((f) => Number(f?.id)))];
    if (ids.some((i) => !Number.isInteger(i) || i <= 0)) throw new BadRequestException('Invalid file.');
    if (!ids.length) return [];
    const rows = await this.prisma.file.findMany({ where: { id: { in: ids }, uploadedById: userId, storageKey: { startsWith: 'work-chat/' } }, select: { id: true, fileName: true, url: true, mimeType: true, fileSize: true } });
    if (rows.length !== ids.length) throw new BadRequestException('Invalid file.');
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((i) => { const r = byId.get(i)!; return { id: r.id, name: r.fileName, url: r.url, mime: r.mimeType, size: r.fileSize }; });
  }

  /** Files tab of a channel: every file shared in it, newest first */
  async channelFiles(channelUid: string, userId: number, o: { type?: string; q?: string; cursor?: string }) {
    const { ch } = await this.channel(channelUid, userId);
    const cursor = o.cursor ? new Date(o.cursor) : null;
    const take = 40;
    const rows = await this.prisma.workChatMessage.findMany({
      where: {
        channelId: ch.id, deletedAt: null, NOT: [{ files: { equals: Prisma.AnyNull } }, { files: { equals: [] } }],
        ...(cursor && !isNaN(+cursor) ? { createdAt: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' }, take: take + 1,
      select: { id: true, parentId: true, createdAt: true, files: true, user: { select: USER_MINI } },
    });
    const page = rows.slice(0, take);
    const kind = (mime: string) => (mime.startsWith('image/') ? 'images' : mime === 'application/pdf' || /word|document|sheet|excel|presentation|powerpoint|text\/|csv/.test(mime) ? 'docs' : mime.startsWith('video/') || mime.startsWith('audio/') ? 'media' : 'other');
    const q = (o.q ?? '').trim().toLowerCase();
    const items = page.flatMap((m) => ((m.files as any[]) ?? []).map((f) => ({ ...f, kind: kind(f.mime ?? ''), messageId: m.id, parentId: m.parentId, createdAt: m.createdAt, user: m.user })))
      .filter((f) => (!o.type || o.type === 'all' || f.kind === o.type) && (!q || String(f.name ?? '').toLowerCase().includes(q)));
    return { items, hasMore: rows.length > take, nextCursor: rows.length > take ? page[page.length - 1]!.createdAt.toISOString() : null };
  }

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
