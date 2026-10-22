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

@Controller('boards/:boardId/automations')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
    private readonly boardsService: BoardsService,
  ) {}

  @Post()
  async create(
    @Param('boardId') boardId: string,
    @Body() dto: CreateAutomationDto,
  ) {
    const id = await this.boardsService.resolveId(boardId);
    return this.automationsService.create(id, dto);
  }

  @Get()
  async findAll(@Param('boardId') boardId: string) {
    const id = await this.boardsService.resolveId(boardId);
    return this.automationsService.findAll(id);
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('boardId') boardId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.toggle(resolvedBoardId, id);
  }

  @Delete(':id')
  async remove(
    @Param('boardId') boardId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.remove(resolvedBoardId, id);
  }

  @Patch(':automationId')
  async update(
    @Param('boardId') boardId: string,
    @Param('automationId', ParseIntPipe) automationId: number,
    @Body() dto: UpdateAutomationDto,
  ) {
    const resolvedBoardId = await this.boardsService.resolveId(boardId);
    return this.automationsService.update(resolvedBoardId, automationId, dto);
  }
}
