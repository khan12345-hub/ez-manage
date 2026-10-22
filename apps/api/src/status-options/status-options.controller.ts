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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';

@Controller()
export class StatusOptionsController {
  constructor(
    private readonly statusOptionsService: StatusOptionsService,
  ) {}

  @Get('board-columns/:columnId/label-values')
  getUniqueLabelValues(
    @Param('columnId', ParseIntPipe) columnId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.statusOptionsService.getUniqueLabelValues(columnId, user.id);
  }

  @Get('board-columns/:columnId/status-options')
  findAll(
    @Param('columnId', ParseIntPipe) columnId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.statusOptionsService.findAll(columnId, user.id);
  }

  @Post('board-columns/:columnId/status-options')
  create(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Body() dto: CreateStatusOptionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.statusOptionsService.create(columnId, dto, user.id);
  }

  @Patch('board-columns/:columnId/status-options/:statusId')
  update(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @Body() dto: UpdateStatusOptionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.statusOptionsService.update(
      columnId,
      statusId,
      user.id,
      dto,
    );
  }

  @Delete('board-columns/:columnId/status-options/:statusId')
  remove(
    @Param('columnId', ParseIntPipe) columnId: number,
    @Param('statusId', ParseIntPipe) statusId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.statusOptionsService.remove(
      columnId,
      statusId,
      user.id,
    );
  }
}
