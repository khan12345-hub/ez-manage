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

import { BoardFormsService } from "./board-forms.service";
import { CreateBoardFormDto } from "./dto/create-board-form.dto";
import { UpdateBoardFormDto } from "./dto/update-board-form.dto";

@Controller("boards/:boardId/form")
export class BoardFormsController {
  constructor(
    private readonly boardFormsService: BoardFormsService,
  ) {}

  @Post()
  createForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Body()
    dto: CreateBoardFormDto,
  ) {
    return this.boardFormsService.create(
      boardId,
      dto,
    );
  }

  @Get()
  getForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,
  ) {
    return this.boardFormsService.findByBoardId(
      boardId,
    );
  }

  @Patch()
  updateForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Body()
    dto: UpdateBoardFormDto,
  ) {
    return this.boardFormsService.update(
      boardId,
      dto,
    );
  }

  @Delete()
  deleteForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,
  ) {
    return this.boardFormsService.delete(
      boardId,
    );
  }
}