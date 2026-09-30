import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // userId → Set of socketIds
  private onlineUsers = new Map<number, Set<string>>();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    const userId = Number(client.handshake.auth?.userId);
    if (!userId) { client.disconnect(); return; }
    client.data.userId = userId;

    if (!this.onlineUsers.has(userId)) this.onlineUsers.set(userId, new Set());
    this.onlineUsers.get(userId)!.add(client.id);

    this.server.emit('user:online', { userId });
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.onlineUsers.delete(userId);
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
    return { joined: data.channelId };
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number },
  ) {
    client.leave(`channel:${data.channelId}`);
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: number; content: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.content?.trim()) return;

    const message = await this.chatService.saveMessage(data.channelId, userId, data.content.trim());

    // Broadcast to everyone in channel room (including sender)
    this.server.to(`channel:${data.channelId}`).emit('message:new', message);

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

  @SubscribeMessage('online:list')
  handleOnlineList() {
    return this.getOnlineUserIds();
  }
}
