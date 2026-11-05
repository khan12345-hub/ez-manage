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
import { CreateAutomationDto } from './dto/create-automation.dto';
import { AutomationsService } from './automations.service';
import { BoardsService } from 'src/boards/boards.service';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { BoardPermissionGuard } from 'src/auth/guards/board-permission.guard';
import { RequireBoardPermission } from 'src/auth/decorators/require-board-permission.decorator';
import { BoardPermission } from '@repo/shared';

// Board members only: VIEW to list, EDIT to change (outsiders/viewers were allowed before).
@Controller('boards/:boardId/automations')
@UseGuards(SessionAuthGuard, BoardPermissionGuard)
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly boardsService: BoardsService,
  ) {}

  @Post()
  @RequireBoardPermission(BoardPermission.EDIT)
  async create(
    @Param('boardId') boardId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.automationsService.create(id, dto);
  }

  @Get()
  @RequireBoardPermission(BoardPermission.VIEW)
  async findAll(@Param('boardId') boardId: string) {
    const id = await this.boardsService.resolveId(boardId);
    return this.automationsService.findAll(id);
  }

  @Patch(':id/toggle')
  @RequireBoardPermission(BoardPermission.EDIT)
  async toggle(
    @Param('boardId') boardId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.toggle(resolvedBoardId, id);
  }

  @Delete(':id')
  @RequireBoardPermission(BoardPermission.EDIT)
  async remove(
    @Param('boardId') boardId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.remove(resolvedBoardId, id);
  }

  @Patch(':automationId')
  @RequireBoardPermission(BoardPermission.EDIT)
  async update(
    @Param('boardId') boardId: string,
    @Param('automationId', ParseIntPipe) automationId: number,
    @Body() dto: UpdateAutomationDto,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.update(resolvedBoardId, automationId, dto);
  }
}
