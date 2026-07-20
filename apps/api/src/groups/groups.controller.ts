import {
  Body,
  Controller,
  Delete,
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
import { DeleteGroupDto } from './dto/delete-group.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';

@Controller('groups')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  create(
    @Body() createGroupDto: CreateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.create(createGroupDto, user.id);
  }

  @Patch('reorder')
  @RequireBoardPermission(BoardPermission.EDIT)
  reorder(
    @Body() dto: ReorderGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.reorder(dto, user.id);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGroupDto: UpdateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.update(
      id,
      updateGroupDto,
      user.id,
    );
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() deleteGroupDto: DeleteGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.remove(
      id,
      deleteGroupDto.boardId,
      user.id,
    );
  }
}