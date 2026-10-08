import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { STORAGE_SERVICE } from '../storage/storage.module';
import { StorageProvider } from '../storage/storage.types';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { ChatNotifPref } from 'generated/prisma/enums';
import { LivekitService } from '../livekit/livekit.service';

/** Global (non-workspace-scoped) chat endpoints */
@Controller('chat')
@UseGuards(SessionAuthGuard)
export class GlobalChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly livekitService: LivekitService,
  ) {}

  /** Returns per-workspace unread totals across ALL workspaces the user belongs to. */
  @Get('all-unread')
  getAllUnread(@CurrentUser() user: SessionUser) {
    return this.chatService.getAllUnreadSummary(user.id);
  }

  /** Generate a LiveKit access token for a callee joining a call room. */
  @Post('livekit-token')
  async getLivekitToken(
    @CurrentUser() user: SessionUser,
    @Body() body: { roomName: string },
  ) {
    const profile = await this.chatService.getUserName(user.id);
    const userName = profile ?? `User ${user.id}`;
    const token = await this.livekitService.createToken(String(user.id), userName, body.roomName);
    return { token, wsUrl: this.livekitService.wsUrl };
  }

  /** Diagnostic: confirms LiveKit env vars are loaded (secret masked). */
  @Get('livekit-check')
  livekitCheck() {
    const key    = process.env.LIVEKIT_API_KEY    ?? '';
    const secret = process.env.LIVEKIT_API_SECRET ?? '';
    const url    = process.env.LIVEKIT_URL        ?? '';
    return {
      configured: Boolean(key && secret && url),
      apiKey:     key    || '(empty)',
      secretLen:  secret.length,
      secretHint: secret ? `${secret.slice(0, 4)}...${secret.slice(-4)}` : '(empty)',
      wsUrl:      url    || '(empty)',
    };
  }
}

@Controller('workspaces/:workspaceId/chat')
@UseGuards(SessionAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly scheduledMessages: ScheduledMessagesService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
  ) {}

  // ── Channels ──────────────────────────────────────────────────────────────

  @Get('channels')
  getChannels(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getChannels(workspaceId, user.id);
  }

  @Post('channels')
  createChannel(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { name: string; description?: string; memberIds?: number[] },
  ) {
    return this.chatService.createChannel(
      workspaceId,
      user.id,
      body.name,
      body.description,
      body.memberIds ?? [],
    );
  }

  // More-specific PATCH routes must come BEFORE channels/:channelId
  @Patch('channels/:channelId/prefs')
  setChannelPref(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { notifPref: ChatNotifPref },
  ) {
    return this.chatService.setChannelPref(channelId, user.id, body.notifPref);
  }

  @Patch('channels/:channelId')
  async updateChannel(
    @Param('channelId', ParseIntPipe) channelId: number,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() caller: SessionUser,
  ) {
    await this.chatService.assertChannelMember(channelId, caller.id);
    return this.chatService.updateChannel(channelId, body.name, body.description);
  }

  @Post('channels/:channelId/join')
  joinChannel(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.joinChannel(channelId, user.id);
  }

  @Post('channels/:channelId/leave')
  leaveChannel(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.leaveChannel(channelId, user.id);
  }

  @Get('channels/:channelId/members')
  getChannelMembers(@Param('channelId', ParseIntPipe) channelId: number) {
    return this.chatService.getChannelMembersFull(channelId);
  }

  @Post('channels/:channelId/members')
  async addChannelMember(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Body() body: { userId: number },
    @CurrentUser() caller: SessionUser,
  ) {
    await this.chatService.assertChannelMember(channelId, caller.id);
    const result = await this.chatService.addChannelMember(channelId, body.userId);
    this.chatGateway.addSocketToChannel(body.userId, channelId);
    return result;
  }

  @Delete('channels/:channelId/members/:userId')
  async removeChannelMember(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('channelId', ParseIntPipe) channelId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() caller: SessionUser,
  ) {
    await this.chatService.assertChannelMember(channelId, caller.id);
    await this.chatService.assertNotGeneralChannel(channelId);
    return this.chatService.removeChannelMember(channelId, userId);
  }

  @Post('channels/:channelId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadFile(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.storage.upload(file, 'chat');
    return {
      url: this.storage.getUrl(result.storageKey),
      originalName: result.fileName,
      type: file.mimetype.startsWith('image/') ? 'image' : 'file',
      mimeType: result.mimeType,
      size: result.fileSize,
    };
  }

  // ── Direct Messages ───────────────────────────────────────────────────────

  @Get('dms')
  getDMs(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getDMs(user.id, workspaceId);
  }

  @Post('dms')
  async getOrCreateDM(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { userId: number },
  ) {
    const otherId = Number(body.userId);
    try {
      const dm = await this.chatService.getOrCreateDM(user.id, otherId, workspaceId);
      this.chatGateway.addSocketToChannel(user.id, dm.id);
      this.chatGateway.addSocketToChannel(otherId, dm.id);
      this.chatGateway.notifyNewDM(otherId, dm);
      return dm;
    } catch (err: any) {
      console.error('[getOrCreateDM] ERROR:', err?.message, err?.code, err?.meta, err?.stack);
      throw new HttpException(
        { message: err?.message ?? 'DM creation failed', code: err?.code, meta: err?.meta },
        err?.status ?? 500,
      );
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get('channels/:channelId/messages')
  getMessages(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(channelId, user.id, cursor ? Number(cursor) : undefined);
  }

  @Get('messages/:messageId/replies')
  getReplies(@Param('messageId', ParseIntPipe) messageId: number) {
    return this.chatService.getReplies(messageId);
  }

  @Post('messages/:messageId/reactions')
  async toggleReaction(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { emoji: string },
  ) {
    const updated = await this.chatService.toggleReaction(messageId, user.id, body.emoji);
    if (updated) this.chatGateway.broadcastMessageUpdate(updated);
    return updated;
  }

  @Patch('messages/:messageId')
  async editMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { content: string },
  ) {
    const updated = await this.chatService.editMessage(messageId, user.id, body.content);
    this.chatGateway.broadcastMessageUpdate(updated);
    return updated;
  }

  @Delete('messages/:messageId')
  deleteMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }

  @Post('channels/:channelId/read')
  markRead(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.markRead(channelId, user.id);
  }

  @Get('unread')
  getUnreadCounts(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getUnreadCounts(workspaceId, user.id);
  }

  @Get('members')
  getWorkspaceMembers(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.chatService.getWorkspaceMembers(workspaceId);
  }

  // ── Link Preview ─────────────────────────────────────────────────────────

  @Get('link-preview')
  getLinkPreview(@Query('url') url: string) {
    if (!url) throw new BadRequestException('url is required');
    return this.chatService.getLinkPreview(url);
  }

  // Returns ALL system users for DM picker
  @Get('users')
  getAllUsers() {
    return this.chatService.getAllUsers();
  }

  @Post('ensure-general')
  async ensureGeneralChannel(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    await this.chatService.assertWorkspaceMember(workspaceId, user.id);
    return this.chatService.ensureGeneralChannel(workspaceId, user.id);
  }

  @Post('messages/:messageId/assign')
  assignMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { assigneeId: number },
  ) {
    return this.chatService.assignMessage(messageId, body.assigneeId, user.id);
  }

  // ── Message Search ────────────────────────────────────────────────────────

  @Get('channels/:channelId/search')
  searchMessages(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
    @Query('q') query: string,
  ) {
    return this.chatService.searchMessages(channelId, user.id, query ?? '');
  }

  // ── Pin Messages ──────────────────────────────────────────────────────────

  @Post('messages/:messageId/pin')
  async pinMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { pin: boolean },
  ) {
    const updated = await this.chatService.pinMessage(messageId, user.id, body.pin ?? true);
    if (updated) this.chatGateway.broadcastMessageUpdate(updated);
    return updated;
  }

  @Get('channels/:channelId/pinned')
  getPinnedMessages(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getPinnedMessages(channelId, user.id);
  }

  // ── Read Receipts ─────────────────────────────────────────────────────────

  @Get('messages/:messageId/seen-by')
  getSeenBy(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getSeenBy(messageId, user.id);
  }

  // ── Scheduled Messages ───────────────────────────────────────────────────

  @Post('channels/:channelId/scheduled')
  createScheduled(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { content: string; scheduledAt: string },
  ) {
    if (!body.content?.trim()) throw new BadRequestException('content is required');
    if (!body.scheduledAt) throw new BadRequestException('scheduledAt is required');
    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be a valid future datetime');
    }
    return this.scheduledMessages.create(channelId, user.id, body.content.trim(), scheduledAt);
  }

  @Get('channels/:channelId/scheduled')
  listScheduled(
    @Param('channelId', ParseIntPipe) channelId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.scheduledMessages.list(channelId, user.id);
  }

  @Delete('scheduled/:id')
  cancelScheduled(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.scheduledMessages.cancel(id, user.id);
  }
}
