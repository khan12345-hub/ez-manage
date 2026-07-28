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

import { TasksService } from './tasks.service';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderTaskDto } from './dto/reorder-task.dto';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';

import { SessionUser } from 'src/auth/types/session-user.type';

import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';

import { BoardPermission } from '@repo/shared';
import { ReorderSubtaskDto } from './dto/reorder-subtask.dto';

@Controller('boards/:boardId/tasks')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @RequireBoardPermission(BoardPermission.CREATE_TASK)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tasksService.create(createTaskDto, user.id, boardId);
  }

  @Patch('reorder')
  @RequireBoardPermission(BoardPermission.EDIT)
  reorder(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: ReorderTaskDto,
  ) {
    return this.tasksService.reorder(dto, boardId);
  }

  @Get(':id')
  @RequireBoardPermission(BoardPermission.VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE_TASK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }

  @Patch(':taskId/reorder-subtask')
  async reorderSubtask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: ReorderSubtaskDto,
  ) {
    return this.tasksService.reorderSubtask(
      taskId,
      dto.previousTaskId ?? null,
      dto.nextTaskId ?? null,
    );
  }
}
