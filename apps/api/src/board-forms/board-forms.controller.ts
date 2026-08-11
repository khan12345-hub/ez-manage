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
import { SubmitBoardFormDto } from "./dto/submit-board-form.dto";

@Controller("boards/:boardId/views/:viewId/form")
export class BoardFormsController {
  constructor(
    private readonly boardFormsService: BoardFormsService,
  ) {}

  @Get()
  getForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Param("viewId", ParseIntPipe)
    viewId: number,
  ) {
    return this.boardFormsService.getByView(
      boardId,
      viewId,
    );
  }

  @Post()
  createForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Param("viewId", ParseIntPipe)
    viewId: number,

    @Body()
    dto: CreateBoardFormDto,
  ) {
    return this.boardFormsService.create(
      boardId,
      viewId,
      dto,
    );
  }

  @Patch()
  updateForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Param("viewId", ParseIntPipe)
    viewId: number,

    @Body()
    dto: UpdateBoardFormDto,
  ) {
    return this.boardFormsService.update(
      boardId,
      viewId,
      dto,
    );
  }

  @Delete()
  deleteForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,

    @Param("viewId", ParseIntPipe)
    viewId: number,
  ) {
    return this.boardFormsService.remove(
      boardId,
      viewId,
    );
  }
}