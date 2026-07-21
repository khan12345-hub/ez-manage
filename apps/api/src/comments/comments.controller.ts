import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CommentsService } from './comments.service';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';
import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

@Controller('boards/:boardId/tasks/:taskId/comments')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.commentsService.create(
      boardId,
      taskId,
      user.id,
      dto,
    );
  }

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  findAll(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.commentsService.findAll(
      boardId,
    );
  }
}