import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';

import { ColumnsService } from './columns.service';

import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ReorderColumnDto } from './dto/reorder-column.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';

@Controller('columns')
export class ColumnsController {
  constructor(
    private readonly columnsService: ColumnsService,

  ) {}

  @Post()
  create(@Body() createColumnDto: CreateColumnDto, @CurrentUser() user: SessionUser) {
    return this.columnsService.create(createColumnDto, user.id);
  }

  @Get()
  findAll() {
    return this.columnsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.columnsService.findOne(id);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderColumnDto) {
    return this.columnsService.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateColumnDto, @CurrentUser() user: SessionUser) {
    return this.columnsService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: SessionUser) {
    return this.columnsService.remove(id, user.id);
  }


}
