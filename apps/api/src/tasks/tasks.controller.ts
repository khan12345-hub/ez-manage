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
import { TaskMutationService } from './task-mutation.service';
import { TaskQueryService } from './task-search.service';
import { TaskReorderService } from './task-reorder.service';
import { TaskCreateService } from './task-create.service';

@Controller('boards/:boardId/tasks')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskCreateService: TaskCreateService,
    private readonly taskQueryService: TaskQueryService,
    private readonly taskReorderService: TaskReorderService,
    private readonly taskMutationService: TaskMutationService,
  ) {}

  @Post()
  @RequireBoardPermission(BoardPermission.CREATE_TASK)
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.taskCreateService.create(createTaskDto, user.id, boardId);
  }

  @Patch('reorder')
  @RequireBoardPermission(BoardPermission.EDIT)
  reorder(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: ReorderTaskDto,
  ) {
    return this.taskReorderService.reorder(dto, boardId);
  }

  @Get(':id')
  @RequireBoardPermission(BoardPermission.VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.taskQueryService.findOne(id);
  }

  @Patch(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.taskMutationService.update(id, dto);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.DELETE_TASK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.taskMutationService.remove(id);
  }

  @Patch(':taskId/reorder-subtask')
  async reorderSubtask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: ReorderSubtaskDto,
  ) {
    return this.taskReorderService.reorderSubtask(
      taskId,
      dto.previousTaskId ?? null,
      dto.nextTaskId ?? null,
    );
  }
  // @Patch('bulk/status')
  // bulkUpdateStatus(
  //   @Param('boardId', ParseIntPipe) boardId: number,
  //   @Body() dto: BulkUpdateTaskCellDto,
  //   @Req() req: any,
  // ) {
  //   return this.tasksService.bulkUpdateStatus(boardId, dto, req.user.id);
  // }

  // @Delete('bulk')
  // bulkDelete(
  //   @Param('boardId', ParseIntPipe) boardId: number,
  //   @Body() dto: BulkDeleteTasksDto,
  //   @Req() req: any,
  // ) {
  //   return this.tasksService.bulkDelete(boardId, dto, req.user.id);
  // }
}
