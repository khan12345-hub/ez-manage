import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationStreamService } from '../notifications/notification-stream.service';
import { PushService } from '../push/push.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
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
  ) {}

  async handleConnection(client: Socket) {
    const userId = Number(client.handshake.auth?.userId);
    if (!userId) { client.disconnect(); return; }
    client.data.userId = userId;

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
    client.join(`channel:${data.channelId}`);
    this.activeChannel.set(client.data.userId, data.channelId);
    return { joined: data.channelId };
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
    const plainText = data.content?.replace(/<[^>]*>/g, '').trim() ?? '';
    if (!userId || (!plainText && !data.attachmentUrl)) return;

    if (this.isRateLimited(userId)) {
      client.emit('error:rate_limited', {
        message: 'Slow down! You can send at most 10 messages every 5 seconds.',
        retryAfterMs: this.RATE_WINDOW_MS,
      });
      return;
    }

    const message = await this.chatService.saveMessage(
      data.channelId,
      userId,
      data.content?.trim() ?? '',
      data.attachmentUrl,
      data.attachmentType,
      data.parentId,
    );

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
    client.to(`channel:${data.channelId}`).emit('typing:start', {
      userId: client.data.userId,
      userName: data.userName,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
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
      jitsiUrl: string;
      workspaceId: number;
      callerName: string;
      channelName: string;
    },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Save a system call message so it appears in chat history
    let callMessageId: number | undefined;
    try {
      const callMsg = await this.chatService.saveCallMessage(data.channelId, userId, data.callType);
      callMessageId = callMsg.id;
      this.server.to(`channel:${data.channelId}`).emit('message:new', callMsg);
    } catch {}

    const payload = { ...data, callerUserId: userId, callMessageId };

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
      if (data.workspaceId) {
        const wsMembers = await this.chatService.getWorkspaceMemberIds(data.workspaceId);
        for (const memberId of wsMembers) {
          if (alreadyNotified.has(memberId)) continue;
          alreadyNotified.add(memberId);
          this.notificationStream.emitRaw(memberId, 'chat_call', payload);
        }
      }
    } catch {}

    // Return callMessageId as socket ACK so the caller can store it in ActiveCall
    return { callMessageId };
  }

  // Track which callMessageIds have been answered (callee clicked Join)
  private readonly answeredCalls  = new Set<number>();
  // Track calls already finalized so a second call:ended from the other party doesn't overwrite
  private readonly finalizedCalls = new Set<number>();

  @SubscribeMessage('call:joined')
  handleCallJoined(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number },
  ) {
    if (data.callMessageId) this.answeredCalls.add(data.callMessageId);
    // Tell the caller to start their duration timer
    client.to(`channel:${data.channelId}`).emit('call:joined', { callMessageId: data.callMessageId });
  }

  @SubscribeMessage('call:ended')
  async handleCallEnded(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number; duration?: number },
  ) {
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
        const callDuration = wasAnswered ? data.duration : undefined;
        const updated = await this.chatService.updateCallStatus(
          data.callMessageId,
          callStatus,
          callDuration,
        );
        this.server.to(`channel:${data.channelId}`).emit('message:updated', updated);
        client.emit('message:updated', updated);
      } catch {}
    }
  }

  @SubscribeMessage('call:declined')
  async handleCallDeclined(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; callMessageId?: number },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

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
