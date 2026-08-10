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

import { GroupsService } from './groups.service';

import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ReorderGroupDto } from './dto/reorder-group.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';

@Controller('boards/:boardId/groups')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
  ) {}

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  findAll(
    @Param("boardId", ParseIntPipe) boardId: number,
  ) {
    return this.groupsService.findAll(boardId);
  }

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() createGroupDto: CreateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.create(
      createGroupDto,
      user.id,
      boardId,
    );
  }

  @Patch('reorder')
  @RequireBoardPermission(BoardPermission.EDIT)
  reorder(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: ReorderGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.reorder(
      dto,
      user.id,
      boardId,
    );
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGroupDto: UpdateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.update(
      id,
      updateGroupDto,
      user.id,
      boardId,
    );
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE)
  remove(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.remove(
      id,
      boardId,
      user.id,
    );
  }
}