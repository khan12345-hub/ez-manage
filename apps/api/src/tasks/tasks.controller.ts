import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { ReorderTaskDto } from './dto/reorder-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tasksService.create(createTaskDto, user.id);
  }

  // @Get()
  // findAll() {
  //   return this.tasksService.findAll();
  // }

    @Patch('reorder')
  reorder(@Body() dto: ReorderTaskDto, @CurrentUser() user: SessionUser) {
    console.log("BACKEND DTO", dto);
    return this.tasksService.reorder(dto);
  }
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tasksService.update(id, dto, user.id);
  }



  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.tasksService.remove(id, user.id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
  //   return this.tasksService.update(+id, updateTaskDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.tasksService.remove(+id);
  // }
}
