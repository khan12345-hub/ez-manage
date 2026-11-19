import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { ChatAccessGuard } from 'src/chat/chat-access.guard';
import { BoardsChatTasksService, type ChatTaskItem } from './boards-chat-tasks.service';

/** Accounts & Invoices team chat → tasks (the guard checks workspace / channel / message access first) */
@Controller('workspaces/:workspaceId/chat')
@UseGuards(SessionAuthGuard, ChatAccessGuard)
export class BoardsChatTasksController {
  constructor(private readonly svc: BoardsChatTasksService) {}

  @Get('channels/:channelId/chat-tasks')
  list(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @CurrentUser() u: SessionUser) {
    return this.svc.list(req.chatWorkspaceId, channelId, u.id);
  }

  @Get('channels/:channelId/chat-task-targets')
  targets(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @CurrentUser() u: SessionUser) {
    return this.svc.targets(req.chatWorkspaceId, channelId, u.id);
  }

  @Post('channels/:channelId/chat-tasks')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @Body() b: { boardId?: number; groupId?: number; items?: ChatTaskItem[] }, @CurrentUser() u: SessionUser) {
    const items = Array.isArray(b?.items) ? b.items.slice(0, 51) : [];
    return this.svc.create(req.chatWorkspaceId, channelId, u.id, {
      boardId: Number.isInteger(b?.boardId) ? b.boardId : undefined,
      groupId: Number.isInteger(b?.groupId) ? b.groupId : undefined,
      items: items.map((i) => ({
        name: String(i?.name ?? ''),
        assigneeIds: Array.isArray(i?.assigneeIds) ? i.assigneeIds.slice(0, 20).map(Number).filter(Number.isInteger) : [],
        dueDate: typeof i?.dueDate === 'string' ? i.dueDate : null,
        priority: typeof i?.priority === 'string' ? i.priority : null,
      })),
    });
  }

  @Put('channels/:channelId/chat-task-default')
  setDefault(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @Body() b: { boardId?: number | null; groupId?: number | null }, @CurrentUser() u: SessionUser) {
    return this.svc.setDefault(req.chatWorkspaceId, channelId, u.id, Number.isInteger(b?.boardId) ? b.boardId! : null, Number.isInteger(b?.groupId) ? b.groupId! : null);
  }

  @Post('channels/:channelId/chat-tasks/:taskId/resolve')
  resolve(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @Param('taskId', ParseIntPipe) taskId: number, @Body() b: { done?: boolean }, @CurrentUser() u: SessionUser) {
    return this.svc.resolve(req.chatWorkspaceId, channelId, u.id, taskId, b?.done !== false);
  }

  @Post('channels/:channelId/chat-tasks/:taskId/status')
  status(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @Param('taskId', ParseIntPipe) taskId: number, @Body() b: { statusId?: number }, @CurrentUser() u: SessionUser) {
    return this.svc.setStatus(req.chatWorkspaceId, channelId, u.id, taskId, Number(b?.statusId));
  }

  @Get('channels/:channelId/mentions')
  mentions(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @CurrentUser() u: SessionUser) {
    return this.svc.mentions(req.chatWorkspaceId, channelId, u.id);
  }

  @Post('messages/:messageId/mention-done')
  mentionDone(@Req() req: any, @Param('messageId', ParseIntPipe) messageId: number, @Body() b: { done?: boolean }, @CurrentUser() u: SessionUser) {
    return this.svc.mentionDone(req.chatWorkspaceId, messageId, u.id, b?.done !== false);
  }

  @Post('channels/:channelId/ai-split')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  aiSplit(@Req() req: any, @Param('channelId', ParseIntPipe) channelId: number, @Body() b: { text?: string; tz?: string }, @CurrentUser() u: SessionUser) {
    return this.svc.aiSplit(req.chatWorkspaceId, channelId, u.id, String(b?.text ?? ''), b?.tz);
  }
}
