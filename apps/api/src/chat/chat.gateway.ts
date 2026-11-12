import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationStreamService } from '../notifications/notification-stream.service';
import { PushService } from '../push/push.service';
import { LivekitService } from '../livekit/livekit.service';
import { allowedOrigins, sessionMiddleware } from '../common/session.middleware';

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

@WebSocketGateway({
  cors: { origin: (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => cb(null, !origin || allowedOrigins().includes(origin)), credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Namespace;

  // userId → Set of socketIds
  private onlineUsers = new Map<number, Set<string>>();
  // userId → channelId they currently have open (joined the socket room)
  private activeChannel = new Map<number, number>();

  // ── In-memory rate limiter for message:send ────────────────────────────────
  // Sliding window: max 10 messages per 5 seconds per user
  private readonly RATE_MAX = 10;
  private readonly RATE_WINDOW_MS = 5_000;
  // userId → timestamps (ms) of recent sends
  private readonly sendTimestamps = new Map<number, number[]>();

  private isRateLimited(userId: number): boolean {
    const now = Date.now();
    const times = (this.sendTimestamps.get(userId) ?? []).filter(
      (t) => now - t < this.RATE_WINDOW_MS,
    );
    if (times.length >= this.RATE_MAX) {
      this.sendTimestamps.set(userId, times);
      return true;
    }
    times.push(now);
    this.sendTimestamps.set(userId, times);
    return false;
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly notificationStream: NotificationStreamService,
    private readonly pushService: PushService,
    private readonly livekitService: LivekitService,
  ) {}

  /** Read the login session from the cookie on every socket handshake (same as HTTP). */
  afterInit(ns: Namespace) {
    const engine = (ns as any).server?.engine ?? (ns as any).engine;
    engine?.use(sessionMiddleware());
  }

  /** Who this socket really is — from the session cookie, never from what the browser says. */
  async handleConnection(client: Socket) {
    // Another website can't open a socket with our user's cookie (cross-site WebSocket hijacking)
    const origin = client.handshake.headers.origin;
    if (origin && !allowedOrigins().includes(origin)) { client.disconnect(true); return; }
    const user = (client.request as any)?.session?.user;
    const userId = Number(user?.id);
    if (!isId(userId)) { client.disconnect(true); return; }
    client.data.userId = userId;
    client.data.userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

    if (!this.onlineUsers.has(userId)) this.onlineUsers.set(userId, new Set());
    this.onlineUsers.get(userId)!.add(client.id);

    this.server.emit('user:online', { userId });

    // Auto-join ALL channel rooms this user belongs to so messages are delivered globally
    try {
      const channelIds = await this.chatService.getUserChannelIds(userId);
      for (const channelId of channelIds) {
        client.join(`channel:${channelId}`);
      }
    } catch {}
  }

  broadcastMessageUpdate(message: any) {
    const channelId = message.channelId ?? message.channel?.workspaceId;
    if (message.channelId) {
      this.server.to(`channel:${message.channelId}`).emit('message:updated', message);
    }
  }

  // Called by controller after adding a member — make their live socket join the room
  addSocketToChannel(userId: number, channelId: number) {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      const clientSocket = this.server.sockets.get(socketId);
      if (clientSocket) clientSocket.join(`channel:${channelId}`);
    }
  }

  // Called after someone leaves / is removed — stop live delivery to them
  removeSocketFromChannel(userId: number, channelId: number) {
    for (const socketId of this.onlineUsers.get(userId) ?? []) {
      this.server.sockets.get(socketId)?.leave(`channel:${channelId}`);
    }
    if (this.activeChannel.get(userId) === channelId) this.activeChannel.delete(userId);
  }

  // Notify a user of a new DM and auto-join their socket to the DM room
  notifyNewDM(userId: number, dm: any) {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      const clientSocket = this.server.sockets.get(socketId);
      if (clientSocket) {
        clientSocket.join(`channel:${dm.id}`);
        clientSocket.emit('dm:new', dm);
      }
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.activeChannel.delete(userId);
        this.sendTimestamps.delete(userId); // free rate-limit state
        this.server.emit('user:offline', { userId });
      }
    }
  }

  getOnlineUserIds(): number[] {
    return Array.from(this.onlineUsers.keys());
  }

  @SubscribeMessage('channel:join')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    const channelId = data?.channelId;
    if (!(await this.chatService.isChannelMember(channelId, client.data.userId))) {
      return { error: 'Not a member of this channel' };
    }
    client.join(`channel:${channelId}`);
    this.activeChannel.set(client.data.userId, channelId);
    return { joined: channelId };
  }

  /** Room events only come from sockets already in that room (joined after a membership check). */
  private inRoom(client: Socket, channelId: unknown): channelId is number {
    return isId(channelId) && client.rooms.has(`channel:${channelId}`);
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    client.leave(`channel:${data.channelId}`);
    if (this.activeChannel.get(client.data.userId) === data.channelId) {
      this.activeChannel.delete(client.data.userId);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; content: string; attachmentUrl?: string; attachmentType?: string; parentId?: number },
  ) {
    const userId = client.data.userId;
    if (!userId || !data || !isId(data.channelId) || typeof data.content !== 'string') return;
    if (data.parentId != null && !isId(data.parentId)) return;
    const plainText = data.content.replace(/<[^>]*>/g, '').trim();
    if (!plainText && !data.attachmentUrl) return;

    if (this.isRateLimited(userId)) {
      client.emit('error:rate_limited', {
        message: 'Slow down! You can send at most 10 messages every 5 seconds.',
        retryAfterMs: this.RATE_WINDOW_MS,
      });
      return;
    }

    let message: Awaited<ReturnType<ChatService['saveMessage']>>;
    try {
      message = await this.chatService.saveMessage(
        data.channelId,
        userId,
        data.content.trim(),
        data.attachmentUrl,
        data.attachmentType,
        data.parentId,
      );
    } catch (e: any) {
      return { error: e?.message ?? 'Could not send' };
    }

    // Broadcast to everyone in channel room (including sender)
    this.server.to(`channel:${data.channelId}`).emit('message:new', message);

    // If this is a reply, also emit reply:new so open thread panels update
    if (data.parentId) {
      this.server.to(`channel:${data.channelId}`).emit('reply:new', message);
    }

    // Notify channel members who are NOT currently viewing this channel via bell icon
    try {
      const members = await this.chatService.getChannelMembers(data.channelId);
      const plainText = data.content.replace(/<[^>]*>/g, '').trim();
      const senderName = `${message.user.firstName} ${message.user.lastName}`;
      for (const m of members) {
        if (m.userId === userId) continue; // don't notify self
        if (this.activeChannel.get(m.userId) === data.channelId) continue; // already watching
        if (m.notifPref === 'MUTED') continue;
        if (m.notifPref === 'MENTIONS' && !plainText.includes(`@${senderName}`) &&
            !plainText.match(/@\w/)) continue; // rough mention check
        this.notificationStream.emitRaw(m.userId, 'chat_unread', {
          channelId: data.channelId,
          senderName,
          preview: plainText.substring(0, 80),
        });
        this.pushService.sendToUser(m.userId, {
          title: senderName,
          body: plainText.substring(0, 100) || '📎 Attachment',
          icon: '/icon-192.png',
          tag: `chat-${data.channelId}`,
          url: `/workspace/${message.channel?.workspaceId}/chat?channel=${data.channelId}`,
        }).catch(() => {});
      }
    } catch {
      // Non-critical: don't crash message delivery if notification fails
    }

    return message;
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; userName: string },
  ) {
    if (!this.inRoom(client, data?.channelId)) return;
    client.to(`channel:${data.channelId}`).emit('typing:start', {
      userId: client.data.userId,
      userName: client.data.userName || data.userName,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    if (!this.inRoom(client, data?.channelId)) return;
    client.to(`channel:${data.channelId}`).emit('typing:stop', {
      userId: client.data.userId,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage('call:start')
  async handleCallStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      channelId: number;
      callType: 'video' | 'voice';
      workspaceId: number;
      callerName: string;
      channelName: string;
    },
  ) {
    const userId = client.data.userId;
    if (!userId || !isId(data?.channelId)) return;
    if (!(await this.chatService.isChannelMember(data.channelId, userId))) return { error: 'Not a member of this channel' };
    // Trust the channel, not the browser: its real workspace and type, and the caller's real name
    const channel = await this.chatService.channelInfo(data.channelId);
    if (!channel) return { error: 'Channel not found' };
    const callerName = client.data.userName || data.callerName;
    const callType = data.callType === 'voice' ? 'voice' : 'video';

    // Generate a unique LiveKit room name for this call
    const roomName = this.livekitService.roomName(data.channelId);

    // Generate a LiveKit token for the caller
    let livekitToken: string | undefined;
    try {
      livekitToken = await this.livekitService.createToken(
        String(userId),
        callerName,
        roomName,
      );
    } catch (e) {
      // If LiveKit is not configured, token will be undefined — callers handle gracefully
    }

    // Save a system call message so it appears in chat history
    let callMessageId: number | undefined;
    try {
      const callMsg = await this.chatService.saveCallMessage(data.channelId, userId, callType);
      callMessageId = callMsg.id;
      this.server.to(`channel:${data.channelId}`).emit('message:new', callMsg);
    } catch {}

    const payload = {
      channelId:    data.channelId,
      callType,
      roomName,
      workspaceId:  channel.workspaceId,
      callerName,
      channelName:  data.channelName,
      callerUserId: userId,
      callMessageId,
    };

    // Notify everyone currently in the channel room (via socket)
    client.to(`channel:${data.channelId}`).emit('call:incoming', payload);

    // Notify via SSE — always notify channel members (covers DMs), plus workspace members
    try {
      const alreadyNotified = new Set<number>([userId]);
      const channelMembers = await this.chatService.getChannelMembers(data.channelId);
      for (const m of channelMembers) {
        if (alreadyNotified.has(m.userId)) continue;
        alreadyNotified.add(m.userId);
        this.notificationStream.emitRaw(m.userId, 'chat_call', payload);
      }
      // Workspace-wide ring only for channels — a direct message call rings just its members
      if (channel.workspaceId && channel.type === 'CHANNEL') {
        const wsMembers = await this.chatService.getWorkspaceMemberIds(channel.workspaceId);
        for (const memberId of wsMembers) {
          if (alreadyNotified.has(memberId)) continue;
          alreadyNotified.add(memberId);
          this.notificationStream.emitRaw(memberId, 'chat_call', payload);
        }
      }
    } catch {}

    // Return room info + caller's LiveKit token as socket ACK
    return { callMessageId, roomName, livekitToken, livekitUrl: this.livekitService.wsUrl };
  }

  // Track which callMessageIds have been answered (callee clicked Join)
  private readonly answeredCalls  = new Set<number>();
  // Track calls already finalized so a second call:ended from the other party doesn't overwrite
  private readonly finalizedCalls = new Set<number>();

  @SubscribeMessage('call:joined')
  async handleCallJoined(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number },
  ) {
    if (!this.inRoom(client, data?.channelId)) return;
    if (data.callMessageId != null && !(await this.chatService.isCallMessageIn(data.callMessageId, data.channelId))) return;
    if (data.callMessageId) this.answeredCalls.add(data.callMessageId);
    // Tell the caller to start their duration timer
    client.to(`channel:${data.channelId}`).emit('call:joined', { callMessageId: data.callMessageId });
  }

  @SubscribeMessage('call:ended')
  async handleCallEnded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number; duration?: number },
  ) {
    if (!this.inRoom(client, data?.channelId)) return;
    if (data.callMessageId != null && !(await this.chatService.isCallMessageIn(data.callMessageId, data.channelId))) return;
    const duration = Number.isFinite(data.duration) && data.duration! >= 0 && data.duration! < 86_400 ? Math.round(data.duration!) : undefined;
    // Dismiss incoming-call toast on the other side
    client.to(`channel:${data.channelId}`).emit('call:ended', { channelId: data.channelId });

    // Update call history message — first call:ended wins; ignore duplicates from the other party
    if (data.callMessageId) {
      if (this.finalizedCalls.has(data.callMessageId)) return;
      this.finalizedCalls.add(data.callMessageId);
      // Auto-clean after 10 min to avoid unbounded memory growth
      setTimeout(() => this.finalizedCalls.delete(data.callMessageId!), 10 * 60 * 1000);

      try {
        const wasAnswered = this.answeredCalls.has(data.callMessageId);
        this.answeredCalls.delete(data.callMessageId);
        // If nobody ever joined, mark as missed (no duration)
        const callStatus   = wasAnswered ? 'ended' : 'missed';
        const callDuration = wasAnswered ? duration : undefined;
        const updated = await this.chatService.updateCallStatus(
          data.callMessageId,
          callStatus,
          callDuration,
        );
        this.server.to(`channel:${data.channelId}`).emit('message:updated', updated);
        client.emit('message:updated', updated);

        // Push notification for missed calls — notify channel members who never joined
        if (callStatus === 'missed') {
          try {
            const callerUserId = (updated as any).userId as number;
            const callerName = `${(updated as any).user?.firstName ?? ''} ${(updated as any).user?.lastName ?? ''}`.trim();
            const callTypeLabel = (updated as any).callType === 'voice' ? 'Voice' : 'Video';
            const wsId = (updated as any).channel?.workspaceId;
            const members = await this.chatService.getChannelMembers(data.channelId);
            for (const m of members) {
              if (m.userId === callerUserId) continue;
              this.pushService.sendToUser(m.userId, {
                title: `Missed ${callTypeLabel} Call`,
                body: callerName ? `${callerName} called` : 'You missed a call',
                icon: '/icon-192.png',
                tag: `missed-call-${data.callMessageId}`,
                url: wsId ? `/workspace/${wsId}/chat` : '/chat',
              }).catch(() => {});
            }
          } catch {}
        }
      } catch {}
    }
  }

  @SubscribeMessage('call:declined')
  async handleCallDeclined(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number },
  ) {
    const userId = client.data.userId;
    if (!userId || !this.inRoom(client, data?.channelId)) return;
    if (data.callMessageId != null && !(await this.chatService.isCallMessageIn(data.callMessageId, data.channelId))) return;

    try {
      const members = await this.chatService.getChannelMembersFull(data.channelId);
      const decliner = members.find((m) => m.userId === userId);
      const name = decliner
        ? `${decliner.user.firstName} ${decliner.user.lastName}`.trim()
        : 'Someone';

      // Notify caller that this user declined
      client.to(`channel:${data.channelId}`).emit('call:declined', {
        channelId: data.channelId,
        declinedByName: name,
      });

      // Update call history message to "declined"
      if (data.callMessageId) {
        const updated = await this.chatService.updateCallStatus(data.callMessageId, 'declined');
        this.server.to(`channel:${data.channelId}`).emit('message:updated', updated);
        client.emit('message:updated', updated);
      }
    } catch {}
  }

  @SubscribeMessage('online:list')
  handleOnlineList() {
    return this.getOnlineUserIds();
  }

  broadcastUserStatus(userId: number, emoji: string | null, text: string | null) {
    this.server.emit('user:status', { userId, statusEmoji: emoji, statusText: text });
  }
}
