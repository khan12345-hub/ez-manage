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
import { SkipThrottle } from '@nestjs/throttler';
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
  UpdateMemberGroupAccessDto,
} from './dto/update-board-access-management.dto';
import { BoardAccessManagementService } from './board-access-management.service';
import { ImportExcelBoardDto } from './dto/import-excel-board.dto';
import { GetBoardTasksDto } from './dto/get-single-board.dto';
import { GetBoardTasksService } from './single-board-tasks.service';
import { boardAllFilesService } from './board-all-files.service';
import { BoardExportService } from './board-export.service';
import { FileImportService } from 'src/file-import/file-import.processor';

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
    private readonly fileImportService: FileImportService,
  ) {}

  @Post()
  create(
    @Body() createBoardDto: CreateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.create(createBoardDto, user.id);
  }

  @Get('recently-viewed')
  getRecentlyViewed(
    @Query('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardsService.getRecentlyViewedBoards(workspaceId, user.id);
  }

  @Get(':boardId/import-progress')
  async getImportProgress(@Param('boardId') boardId: string) {
    const id = await this.boardsService.resolveId(boardId);
    return this.fileImportService.getProgress(id);
  }

  @Delete(':boardId/import')
  @RequireBoardPermission(BoardPermission.EDIT)
  async pauseImport(@Param('boardId') boardId: string) {
    const id = await this.boardsService.resolveId(boardId);
    await this.fileImportService.pause(id);
    return { paused: true };
  }

  @Post(':boardId/import/resume')
  @RequireBoardPermission(BoardPermission.EDIT)
  async resumeImport(@Param('boardId') boardId: string) {
    const id = await this.boardsService.resolveId(boardId);
    await this.fileImportService.resume(id);
    return { resumed: true };
  }

  @Get(':boardId/export')
  @RequireBoardPermission(BoardPermission.EXPORT_BOARD)
  async exportBoard(
    @Param('boardId') boardId: string,
    @Query('groupId') groupId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    const { buffer, filename } = await this.boardExportService.exportBoard(
      id,
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
  async getGroupList(
    @Param('boardId') boardId: string,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardsService.getGroupList(id);
  }

  @Get(':boardId')
  @RequireBoardPermission(BoardPermission.VIEW)
  async findOne(
    @Param('boardId') boardId: string,
    @CurrentUser() user: SessionUser,
    @Query('search') search?: string,
    @Query('person') person?: string,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardsService.findOne(id, user.id);
  }

  @Get(':boardId/members')
  @RequireBoardPermission(BoardPermission.VIEW)
  async findMembers(
    @Param('boardId') boardId: string,
    @Query('search') search: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardsService.findMembers(id, user.id, search);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  async update(
    @Param('id') id: string,
    @Body() updateBoardDto: UpdateBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    const boardId = await this.boardsService.resolveId(id);
    return this.boardsService.update(boardId, updateBoardDto, user.id);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE_BOARD)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
  ) {
    const boardId = await this.boardsService.resolveId(id);
    return this.boardsService.remove(boardId, user.id);
  }

  @Put(':boardId/columns/:columnId/permissions')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateColumnPermission(
    @Param('boardId') boardId: string,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: UpdateColumnPermissionDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.columnAccessService.updateColumnPermission(id, columnId, dto, user.id);
  }

  @Delete(':boardId/columns/:columnId/permissions/:targetUserId')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async removeColumnPermission(
    @Param('boardId') boardId: string,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.columnAccessService.removeColumnPermission(id, columnId, targetUserId, user.id);
  }

  @Patch(':boardId/access/visibility')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateVisibility(
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardVisibilityDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAccessManagementService.updateVisibility(id, user.id, dto.visibility);
  }

  @Patch(':boardId/access/members/:memberId/role')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateMemberRole(
    @Param('boardId') boardId: string,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateBoardMemberRoleDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAccessManagementService.updateMemberRole(id, memberId, user.id, dto.role);
  }

  @Delete(':boardId/access/members/:memberId')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async removeMember(
    @Param('boardId') boardId: string,
    @Param('memberId', ParseIntPipe) memberId: number,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAccessManagementService.removeMember(id, memberId, user.id);
  }

  @Patch(':boardId/access/members/:memberId/groups')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateMemberGroupAccess(
    @Param('boardId') boardId: string,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberGroupAccessDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAccessManagementService.updateMemberGroupAccess(
      id,
      memberId,
      user.id,
      dto.accessAllGroups,
      dto.groupIds,
    );
  }

  @Put(':boardId/columns/:columnId/access')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async updateColumnAccess(
    @Param('boardId') boardId: string,
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: UpdateColumnAccessDto,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.columnAccessService.updateColumnAccess(id, columnId, dto, user.id);
  }

  @Post(':boardId/view')
  @RequireBoardPermission(BoardPermission.VIEW)
  async trackView(
    @Param('boardId') boardId: string,
    @CurrentUser() user: SessionUser,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardsService.trackView(id, user.id);
  }

  @Get(':boardId/views')
  @RequireBoardPermission(BoardPermission.VIEW)
  async getBoardViews(
    @Param('boardId') boardId: string,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardsService.getBoardViews(id);
  }

  @Post('import/excel')
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  async importExcelBoard(
    @Body() dto: ImportExcelBoardDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardImportService.startImport(dto, user.id);
  }

  @Get('import-jobs/:jobId')
  async getImportJob(
    @Param('jobId', ParseIntPipe) jobId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.boardImportService.getImportJob(jobId, user.id);
  }

  @SkipThrottle()
  @Get(':boardId/tasks')
  @RequireBoardPermission(BoardPermission.VIEW)
  async getBoardTasks(
    @Param('boardId') boardId: string,
    @Query('groupId') groupId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
    @Query('person') person?: string,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.getBoardTasksService.execute({
      boardId: id,
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
    @Param('boardId') boardId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('search') search?: string,
    @Query('person') person?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.getBoardTasksService.getGroupTasks(
      id,
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
    @Param('boardId') boardId: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAllFilesService.findAllBoardFiles(id, {
      type,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 80,
    });
  }

  @Delete(':boardId/files/:fileId')
  @RequireBoardPermission(BoardPermission.EDIT)
  async deleteBoardFile(
    @Param('boardId') boardId: string,
    @Param('fileId', ParseIntPipe) fileId: number,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.boardAllFilesService.deleteBoardFile(id, fileId);
  }
}
