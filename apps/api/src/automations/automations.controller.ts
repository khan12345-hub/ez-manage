import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { AutomationsService } from "./automations.service";

@Controller('boards/:boardId/automations')
export class AutomationsController {
  constructor(
    private readonly automationsService: AutomationsService,
  ) {}

  @Post()
  create(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: CreateAutomationDto,
  ) {
    return this.automationsService.create(boardId, dto);
  }

  @Get()
  findAll(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.automationsService.findAll(boardId);
  }

  @Patch(':id/toggle')
  toggle(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.automationsService.toggle(boardId, id);
  }

  @Delete(':id')
  remove(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.automationsService.remove(boardId, id);
  }
}