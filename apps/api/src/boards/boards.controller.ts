import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { BoardAccessService } from './board-access.service';

@Controller('boards')
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardsAccessService: BoardAccessService,
  ) {}

  @Post()
  create(
    @Body() createBoardDto: CreateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.create(createBoardDto, user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    const isMember = this.boardsAccessService.requireViewer(id, user.id);
    if (!isMember) {
      throw new ForbiddenException(
        `Board not found or you don't have valid permission`,
      );
    }
    return this.boardsService.findOne(id);
  }

  @Get(':boardId/members')
  findMembers(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query('search') search: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.findMembers(boardId, user.id, search);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBoardDto: UpdateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    // Verify user is board creator (owner)
    const board = await this.boardsService.findOne(id);
    if (!board || board.createdById !== user.id) {
      throw new ForbiddenException('Only board creator can update this board');
    }
    return this.boardsService.update(id, updateBoardDto, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    // Verify user is board creator (owner)
    const board = await this.boardsService.findOne(id);
    if (!board || board.createdById !== user.id) {
      throw new ForbiddenException('Only board creator can delete this board');
    }
    return this.boardsService.remove(id, user.id);
  }
}
