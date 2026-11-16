import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LivekitService } from 'src/livekit/livekit.service';
import { WorkChatService } from './work-chat.service';

type Live = { channelId: number; channelUid: string; messageId: number; callerId: number; video: boolean; startedAt: number; joined: Set<number>; answered: boolean; ended: boolean };
const ROOM = /^wk-ch(\d+)-\d+$/;

/**
 * Work chat calls (voice / video, like ClickUp SyncUps) on the same LiveKit server as Boards.
 * Starting posts a call message and rings the channel's members over the live stream; only
 * people who can open the channel get a call pass. Ending updates the call message
 * ("· 4 min" / "Missed call") and stops the ringing for everyone.
 */
@Injectable()
export class WorkCallsService {
  private readonly live = new Map<string, Live>();
  constructor(private readonly prisma: PrismaService, private readonly chat: WorkChatService, private readonly livekit: LivekitService) {}

  private async name(userId: number) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    return u ? `${u.firstName} ${u.lastName}`.trim() : 'Someone';
  }

  private async pass(room: string, userId: number) {
    if (!this.livekit.isConfigured()) throw new ServiceUnavailableException('Calls are not set up on this server (LiveKit).');
    return { token: await this.livekit.createToken(String(userId), await this.name(userId), room), url: this.livekit.wsUrl };
  }

  /** channel members to ring (not a whole public workspace) */
  private async members(channelId: number) {
    return (await this.prisma.workChannelMember.findMany({ where: { channelId }, select: { userId: true } })).map((m) => m.userId);
  }

  async start(channelUid: string, userId: number, video: boolean) {
    const { ch } = await this.chat.channel(channelUid, userId, 'post');
    const room = `wk-ch${ch.id}-${Date.now()}`;
    const pass = await this.pass(room, userId);
    const kind = video ? 'Video' : 'Voice';
    const msg: any = await this.chat.send(channelUid, userId, { content: `📞 ${kind} call started` });
    const callerName = await this.name(userId);
    this.live.set(room, { channelId: ch.id, channelUid, messageId: msg.id, callerId: userId, video, startedAt: Date.now(), joined: new Set([userId]), answered: false, ended: false });
    const others = (await this.members(ch.id)).filter((u) => u !== userId);
    this.chat.push(others, 'call', { channelUid, call: { action: 'ring', room, video, callerId: userId, callerName, channelName: ch.kind === 'dm' ? callerName : `#${ch.name}` } });
    // nobody answered in 45 s: it becomes a missed call
    setTimeout(() => { const c = this.live.get(room); if (c && !c.ended && !c.answered) void this.finish(room, 'missed'); }, 45_000);
    return { room, video, ...pass };
  }

  /** a call pass for someone who can open the channel */
  async join(room: string, userId: number) {
    const m = ROOM.exec(String(room ?? ''));
    if (!m) throw new BadRequestException('Unknown call.');
    const ch = await this.prisma.workChannel.findUnique({ where: { id: Number(m[1]) }, select: { uid: true } });
    if (!ch) throw new NotFoundException('Call not found.');
    await this.chat.channel(ch.uid, userId, 'view');
    const c = this.live.get(room);
    if (c && !c.ended) { c.joined.add(userId); if (userId !== c.callerId) c.answered = true; this.chat.push([c.callerId], 'call', { channelUid: ch.uid, call: { action: 'joined', room, userId } }); }
    return { room, video: c?.video ?? true, ...(await this.pass(room, userId)) };
  }

  async decline(room: string, userId: number) {
    const c = this.live.get(room);
    if (!c || c.ended) return { ok: true };
    await this.chat.channel(c.channelUid, userId, 'view');
    this.chat.push([c.callerId], 'call', { channelUid: c.channelUid, call: { action: 'declined', room, byName: await this.name(userId) } });
    return { ok: true };
  }

  /** leaving: the call is over when the caller leaves or the last person does */
  async leave(room: string, userId: number) {
    const c = this.live.get(room);
    if (!c || c.ended) return { ok: true };
    await this.chat.channel(c.channelUid, userId, 'view');
    c.joined.delete(userId);
    if (userId === c.callerId || c.joined.size === 0) await this.finish(room, c.answered ? 'ended' : 'missed');
    return { ok: true };
  }

  private async finish(room: string, how: 'ended' | 'missed') {
    const c = this.live.get(room);
    if (!c || c.ended) return;
    c.ended = true;
    const kind = c.video ? 'Video' : 'Voice';
    const mins = Math.max(1, Math.round((Date.now() - c.startedAt) / 60000));
    await this.chat.setCallMessage(c.messageId, how === 'missed' ? `📞 Missed ${kind.toLowerCase()} call` : `📞 ${kind} call · ${mins} min`).catch(() => null);
    this.chat.push(await this.members(c.channelId), 'call', { channelUid: c.channelUid, call: { action: 'ended', room } });
    setTimeout(() => this.live.delete(room), 60_000);
  }
}
