import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";

import { BoardTemplatesService } from "./board-templates.service";

import { CreateBoardTemplateDto } from "./dto/create-board-template.dto";
import { UpdateBoardTemplateDto } from "./dto/update-board-template.dto";

@Controller("board-templates")
export class BoardTemplatesController {
  constructor(
    private readonly boardTemplatesService: BoardTemplatesService,
  ) {}

  @Get()
  findAll() {
    return this.boardTemplatesService.findAll();
  }

  @Get(":templateId")
  findOne(
    @Param("templateId", ParseIntPipe)
    templateId: number,
  ) {
    return this.boardTemplatesService.findOne(templateId);
  }

  @Post()
  create(
    @Body()
    dto: CreateBoardTemplateDto,
  ) {
    return this.boardTemplatesService.create(dto);
  }

  @Patch(":templateId")
  update(
    @Param("templateId", ParseIntPipe)
    templateId: number,

    @Body()
    dto: UpdateBoardTemplateDto,
  ) {
    return this.boardTemplatesService.update(
      templateId,
      dto,
    );
  }

  @Delete(":templateId")
  remove(
    @Param("templateId", ParseIntPipe)
    templateId: number,
  ) {
    return this.boardTemplatesService.remove(templateId);
  }
}