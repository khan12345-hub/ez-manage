import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { StatusOptionsService } from './status-options.service';
import { CreateStatusOptionDto } from './dto/create-status-option.dto';
import { UpdateStatusOptionDto } from './dto/update-status-option.dto';

@Controller()
export class StatusOptionsController {
  constructor(
    private readonly statusOptionsService: StatusOptionsService,
  ) {}

  @Get('board-columns/:columnId/status-options')
  findAll(
    @Param('columnId', ParseIntPipe) columnId: number,
  ) {
    return this.statusOptionsService.findAll(columnId);
  }

  @Post('board-columns/:columnId/status-options')
  create(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: CreateStatusOptionDto,
  ) {
    return this.statusOptionsService.create(columnId, dto);
  }

  @Patch('board-columns/:columnId/status-options/:statusId')
  update(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @Body() dto: UpdateStatusOptionDto,
  ) {
    return this.statusOptionsService.update(
      columnId,
      statusId,
      dto,
    );
  }

  @Delete('board-columns/:columnId/status-options/:statusId')
  remove(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
  ) {
    return this.statusOptionsService.remove(
      columnId,
      statusId,
    );
  }
}

