import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';
import { BoardImportService } from './board-import.service';
import { UpdateColumnPermissionDto } from './dto/update-column-permission.dto';
import { ColumnsAccessService } from './update-column-access.service';
import { UpdateColumnAccessDto } from './dto/update-column-access.dto';
import {
  UpdateBoardMemberRoleDto,
  UpdateBoardVisibilityDto,
} from './dto/update-board-access-management.dto';
import { BoardAccessManagementService } from './board-access-management.service';
import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { GetBoardTasksDto } from './dto/get-single-board.dto';
import { GetBoardTasksService } from './single-board-tasks.service';
import { boardAllFilesService } from './board-all-files.service';
import { BoardExportService } from './board-export.service';

@Controller('boards')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardImportService: BoardImportService,
    private readonly columnAccessService: ColumnsAccessService,
    private readonly boardAccessManagementService: BoardAccessManagementService,
    private readonly getBoardTasksService: GetBoardTasksService,
    private readonly boardAllFilesService: boardAllFilesService,
    private readonly boardExportService: BoardExportService,
  ) {}

  @Post()
  create(
    @Body() createBoardDto: CreateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.create(createBoardDto, user.id);
  }

  @Get(':boardId/export')
  @RequireBoardPermission(BoardPermission.EXPORT_BOARD)
  async exportBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query('groupId') groupId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename } = await this.boardExportService.exportBoard(
      boardId,
      groupId ? Number(groupId) : undefined,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':boardId/group-list')
  @RequireBoardPermission(BoardPermission.VIEW)
  getGroupList(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardsService.getGroupList(boardId);
  }

  @Get(':boardId')
  @RequireBoardPermission(BoardPermission.VIEW)
  async findOne(
    @Param('boardId', ParseIntPipe)
    boardId: number,

    @CurrentUser()
    user: SessionUser,

    @Query('search')
    search?: string,

    @Query('person')
    person?: string,
  ) {
    return this.boardsService.findOne(boardId, user.id);
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
  @RequireBoardPermission(BoardPermission.DELETE_BOARD)
  remove(
    @Param('id', ParseIntPipe)
    id: number,

    @CurrentUser()
    user: SessionUser,
  ) {
    return this.boardsService.remove(id, user.id);
  }

  @Put(':boardId/columns/:columnId/permissions')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateColumnPermission(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: UpdateColumnPermissionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.columnAccessService.updateColumnPermission(
      boardId,
      columnId,
      dto,
      user.id,
    );
  }

  @Delete(':boardId/columns/:columnId/permissions/:targetUserId')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async removeColumnPermission(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.columnAccessService.removeColumnPermission(
      boardId,
      columnId,
      targetUserId,
      user.id,
    );
  }

  @Patch(':boardId/access/visibility')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateVisibility(
    @Param('boardId') boardId: number,
    @Body() dto: UpdateBoardVisibilityDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardAccessManagementService.updateVisibility(
      boardId,
      user.id,
      dto.visibility,
    );
  }

  @Patch(':boardId/access/members/:memberId/role')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateMemberRole(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateBoardMemberRoleDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardAccessManagementService.updateMemberRole(
      boardId,
      memberId,
      user.id,
      dto.role,
    );
  }

  @Delete(':boardId/access/members/:memberId')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async removeMember(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardAccessManagementService.removeMember(
      boardId,
      memberId,
      user.id,
    );
  }

  @Put(':boardId/columns/:columnId/access')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateColumnAccess(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: UpdateColumnAccessDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.columnAccessService.updateColumnAccess(
      boardId,
      columnId,
      dto,
      user.id,
    );
  }

  @Post(':boardId/view')
  @RequireBoardPermission(BoardPermission.VIEW)
  trackView(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.trackView(boardId, user.id);
  }

  @Get(':boardId/views')
  @RequireBoardPermission(BoardPermission.VIEW)
  getBoardViews(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardsService.getBoardViews(boardId);
  }

  @Post('import/excel')
  async importExcelBoard(
    @Body() dto: ImportExcelBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardImportService.importExcelBoard(dto, user.id);
  }

  @Get(':boardId/tasks')
  @RequireBoardPermission(BoardPermission.VIEW)
  getBoardTasks(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
    @Query('person') person?: string,
  ) {
    return this.getBoardTasksService.execute({
      boardId,
      groupId: groupId ? Number(groupId) : undefined,
      limit: limit ? Number(limit) : 50,
      cursor: cursor ? Number(cursor) : undefined,
      search,
      person,
    });
  }
  @Get(':boardId/groups/:groupId/tasks')
  @RequireBoardPermission(BoardPermission.VIEW)
  async getGroupTasks(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('search') search?: string,
    @Query('person') person?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.getBoardTasksService.getGroupTasks(
      boardId,
      groupId,
      search,
      person,
      Math.min(limit ?? 50, 50),
      offset ?? 0,
    );
  }
@Get(':boardId/files')
@RequireBoardPermission(BoardPermission.VIEW)
async findAllBoardFiles(
  @Param('boardId', ParseIntPipe) boardId: number,
) {
  return this.boardAllFilesService.findAllBoardFiles(boardId);
}

@Delete(':boardId/files/:fileId')
@RequireBoardPermission(BoardPermission.EDIT)
async deleteBoardFile(
  @Param('boardId', ParseIntPipe) boardId: number,
  @Param('fileId', ParseIntPipe) fileId: number,
) {
  return this.boardAllFilesService.deleteBoardFile(boardId, fileId);
}
}
