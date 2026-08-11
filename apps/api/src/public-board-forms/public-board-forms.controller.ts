import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';

import { PublicBoardFormsService } from './public-board-forms.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { SubmitBoardFormDto } from 'src/board-forms/dto/submit-board-form.dto';

@Controller('public')
export class PublicBoardFormsController {
  constructor(
    private readonly publicBoardFormsService: PublicBoardFormsService,
  ) {}

  /** GET /public/form/:boardId — fetch the public form definition */
  @Public()
  @Get('form/:boardId')
  async getPublicForm(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.publicBoardFormsService.findPublicByBoardId(boardId);
  }

  /** POST /public/form/:boardId/submit — submit the public form (no auth) */
  @Public()
  @Post('form/:boardId/submit')
  async submitPublicForm(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: SubmitBoardFormDto,
  ) {
    return this.publicBoardFormsService.submit(boardId, dto);
  }
}
