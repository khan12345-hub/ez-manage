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

import { BoardDocumentsService } from './board-documents.service';
import { CreateBoardDocumentDto } from './dto/create-board-document.dto';
import { UpdateBoardDocumentDto } from './dto/update-board-document.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';
import { BoardPermission } from '@repo/shared';

@Controller('boards/:boardId/documents')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class BoardDocumentsController {
  constructor(private readonly boardDocumentsService: BoardDocumentsService) {}

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  findAll(@Param('boardId', ParseIntPipe) boardId: number) {
    return this.boardDocumentsService.findAll(boardId);
  }

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: CreateBoardDocumentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardDocumentsService.create(boardId, user.id, dto);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBoardDocumentDto,
  ) {
    return this.boardDocumentsService.update(id, boardId, dto);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  remove(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.boardDocumentsService.remove(id, boardId);
  }
}
