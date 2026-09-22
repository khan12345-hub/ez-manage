import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';

import { memoryStorage } from 'multer';

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
  constructor(private readonly cellsService: CellsService) {}

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Body()
    createCellDto: CreateCellDto,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.cellsService.create(createCellDto, boardId, user.id);
  }

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  findAll(
    @Param('boardId', ParseIntPipe)
    boardId: number,
  ) {
    return this.cellsService.findAll(boardId);
  }

  @Get(':id')
  @RequireBoardPermission(BoardPermission.VIEW)
  findOne(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.cellsService.findOne(id, boardId);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  updateCell(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateCellDto,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.cellsService.updateCell(id, dto, user.id, boardId);
  }

  @Post(':cellId/files')
  @RequireBoardPermission(BoardPermission.EDIT)
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  }))
  uploadFiles(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Param('cellId', ParseIntPipe)
    cellId: number,

    @UploadedFiles()
    files: Express.Multer.File[],

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.cellsService.uploadFiles(cellId, boardId, user.id, files ?? []);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE)
  remove(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.cellsService.remove(id, boardId);
  }

  @Delete(':cellId/files/:fileId')
  @UseGuards(BoardPermissionGuard)
  @RequireBoardPermission(BoardPermission.EDIT)
  removeFile(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('cellId', ParseIntPipe) cellId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.cellsService.removeFile(boardId, cellId, fileId, user.id);
  }
}
