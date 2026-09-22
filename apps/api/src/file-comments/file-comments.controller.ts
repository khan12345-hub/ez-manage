import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { FileCommentsService } from './file-comments.service';
import { CreateFileCommentDto } from './dto/create-file-comment.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';

@Controller('files/:fileId/comments')
export class FileCommentsController {
  constructor(private readonly service: FileCommentsService) {}

  @Get()
  findAll(@Param('fileId', ParseIntPipe) fileId: number) {
    return this.service.findAll(fileId);
  }

  @Post()
  create(
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateFileCommentDto,
  ) {
    return this.service.create(fileId, user.id, dto);
  }

  @Delete(':commentId')
  remove(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.service.remove(fileId, commentId, user.id);
  }
}
