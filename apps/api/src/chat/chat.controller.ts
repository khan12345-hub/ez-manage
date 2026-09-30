import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';

@Controller('workspaces/:workspaceId/chat')
@UseGuards(SessionAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
    @Body() body: { name: string; description?: string },
  ) {
    return this.chatService.createChannel(workspaceId, user.id, body.name, body.description);
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

  // ── Direct Messages ───────────────────────────────────────────────────────

  @Get('dms')
  getDMs(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.getDMs(workspaceId, user.id);
  }

  @Post('dms')
  getOrCreateDM(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { userId: number },
  ) {
    return this.chatService.getOrCreateDM(workspaceId, user.id, body.userId);
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

  @Post('ensure-general')
  ensureGeneralChannel(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.chatService.ensureGeneralChannel(workspaceId, user.id);
  }
}
