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

import { CellsService } from './cells.service';

import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';

import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';

@Controller('boards/:boardId/cells')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class CellsController {
  constructor(
    private readonly cellsService: CellsService,
  ) {}

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() createCellDto: CreateCellDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.cellsService.create(
      createCellDto,
      boardId,
      user.id,
    );
  }

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  findAll(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.cellsService.findAll(boardId);
  }

  @Get(':id')
  @RequireBoardPermission(BoardPermission.VIEW)
  findOne(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cellsService.findOne(id, boardId);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  updateCell(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCellDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.cellsService.updateCell(
      id,
      dto,
      user.id,
      boardId,
    );
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE)
  remove(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cellsService.remove(id, boardId);
  }
}