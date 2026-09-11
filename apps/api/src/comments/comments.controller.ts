import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';

import { CommentsService } from './comments.service';

import { CreateCommentDto } from './dto/create-comment.dto';

import type { Express } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';

@Controller('tasks')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post(':taskId/comments')
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Body()
    dto: CreateCommentDto,

    @UploadedFiles()
    files: any[],

    @CurrentUser()
    user: SessionUser,
  ) {
    // Replace with authenticated user ID

    return this.commentsService.create(taskId, user.id, dto, files ?? []);
  }

  @Post(':taskId/comments/:commentId/replies')
  @UseInterceptors(FilesInterceptor('files', 10))
  async createReply(
    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Param('commentId', ParseIntPipe)
    commentId: number,

    @Body()
    dto: CreateCommentDto,

    @UploadedFiles()
    files: any[],

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.commentsService.createReply(
      taskId,
      commentId,
      user.id,
      dto,
      files ?? [],
    );
  }

  @Post(':taskId/comments/:commentId/reactions')
  async toggleReaction(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: CreateReactionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.commentsService.toggleReaction(commentId, user.id, dto.emoji);
  }

  @Delete('/comments/:commentId/files/:fileId')
  async deleteFile(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.commentsService.deleteFile(commentId, fileId, user.id);
  }

  @Patch(':taskId/comments/:commentId') async update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.commentsService.update(taskId, commentId, user.id, dto);
  }
  @Delete(':taskId/comments/:commentId') async remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.commentsService.remove(taskId, commentId, user.id);
  }

  @Get(':taskId/comments')
  async findAllByTask(
    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.commentsService.findAllByTask(
      taskId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
  @Get(':taskId/files')
  async findAllTaskFiles(
    @Param('taskId', ParseIntPipe)
    taskId: number,
  ) {
    return this.commentsService.findAllTaskFiles(taskId);
  }
}
