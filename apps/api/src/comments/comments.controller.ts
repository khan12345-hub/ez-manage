import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
  ) {
    // Replace with authenticated user ID
    const userId = 1;

    return this.commentsService.create(taskId, userId, dto, files ?? []);
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
  ) {
    // Replace with authenticated user ID
    const userId = 1;

    return this.commentsService.createReply(
      taskId,
      commentId,
      userId,
      dto,
      files ?? [],
    );
  }

@Delete(':commentId/files/:fileId')
async deleteFile(
  @Param('commentId', ParseIntPipe) commentId: number,
  @Param('fileId', ParseIntPipe) fileId: number,
  @CurrentUser() user: SessionUser,
) {
  return this.commentsService.deleteFile(
    commentId,
    fileId,
    user.id,
  );
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
}
