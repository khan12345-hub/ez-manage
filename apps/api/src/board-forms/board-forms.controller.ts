import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { BoardFormsService } from "./board-forms.service";
import { CreateBoardFormDto } from "./dto/create-board-form.dto";
import { UpdateBoardFormDto } from "./dto/update-board-form.dto";
import { SessionAuthGuard } from "src/auth/guards/session.guard";
import { BoardPermissionGuard } from "src/auth/guards/board-permission.guard";
import { RequireBoardPermission } from "src/auth/decorators/require-board-permission.decorator";
import { BoardPermission } from "@repo/shared";

@UseGuards(SessionAuthGuard, BoardPermissionGuard)
@Controller("boards/:boardId/form")
export class BoardFormsController {
  constructor(
    private readonly boardFormsService: BoardFormsService,
  ) {}

  @Post()
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
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
  @RequireBoardPermission(BoardPermission.VIEW)
  getForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,
  ) {
    return this.boardFormsService.findByBoardId(
      boardId,
    );
  }

  @Patch()
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
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
  @RequireBoardPermission(BoardPermission.MANAGE_SETTINGS)
  deleteForm(
    @Param("boardId", ParseIntPipe)
    boardId: number,
  ) {
    return this.boardFormsService.delete(
      boardId,
    );
  }
}