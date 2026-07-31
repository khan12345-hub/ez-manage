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
  UseGuards,
} from '@nestjs/common';

import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';
import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { BoardImportService } from './board-import.service';

@Controller('boards')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardImportService: BoardImportService,
  ) {}

  @Post()
  create(
    @Body() createBoardDto: CreateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.create(createBoardDto, user.id);
  }

  @Get(':boardId')
  @RequireBoardPermission(BoardPermission.VIEW)
  async findOne(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Query('search')
    search?: string,

    @Query('person')
    person?: string,
  ) {
    return this.boardsService.findOne(boardId, search, person);
  }

  @Get(':boardId/members')
  @RequireBoardPermission(BoardPermission.VIEW)
  findMembers(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Query('search')
    search: string,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.boardsService.findMembers(boardId, user.id, search);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    updateBoardDto: UpdateBoardDto,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.boardsService.update(id, updateBoardDto, user.id);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE)
  remove(
    @Param('id', ParseIntPipe)
    id: number,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.boardsService.remove(id, user.id);
  }

  // @Post('import/excel')
  // async importExcelBoard(
  //   @Body()
  //   dto: ImportExcelBoardDto,
  //   @CurrentUser()
  //   user: SessionUser,
  // ) {
  //   const userId = 'CURRENT_USER_ID';

  //   return this.boardImportService.importExcelBoard(user.id, dto);
  // }
}
