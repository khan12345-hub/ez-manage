import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import {
  FilesInterceptor,
} from '@nestjs/platform-express';

import { CommentsService } from './comments.service';

import { CreateCommentDto } from './dto/create-comment.dto';

import type { Express } from 'express';

@Controller('tasks')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  @Post(':taskId/comments')
  @UseInterceptors(
    FilesInterceptor(
      'files',
      10,
    ),
  )
  async create(
    @Param(
      'taskId',
      ParseIntPipe,
    )
    taskId: number,

    @Body()
    dto: CreateCommentDto,

    @UploadedFiles()
    files: any[],
  ) {
    // Replace this with your actual
    // authenticated user ID.
    const userId = 1;

    return this.commentsService.create(
      taskId,
      userId,
      dto,
      files ?? [],
    );
  }
}