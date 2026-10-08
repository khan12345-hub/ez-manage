import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { PublicBoardFormsService } from './public-board-forms.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { SubmitBoardFormDto } from 'src/board-forms/dto/submit-board-form.dto';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import { StorageProvider } from 'src/storage/storage.types';

@Controller('public')
export class PublicBoardFormsController {
  constructor(
    private readonly publicBoardFormsService: PublicBoardFormsService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
  ) {}

  /** GET /public/form/:boardId — fetch the public form definition */
  @Public()
  @Get('form/:boardId')
  async getPublicForm(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.publicBoardFormsService.findPublicByBoardId(boardId);
  }

  /** GET /public/form/:boardId/members — board members for person picker (no auth) */
  @Public()
  @Get('form/:boardId/members')
  async getFormMembers(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.publicBoardFormsService.getBoardMembers(boardId);
  }

  /** POST /public/form/:boardId/upload — upload a file from a public form (no auth) */
  @Public()
  @Post('form/:boardId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const result = await this.storage.upload(file, 'form-uploads');
    return {
      url: this.storage.getUrl(result.storageKey),
      storageKey: result.storageKey,
      originalName: result.fileName,
      mimeType: result.mimeType,
      size: result.fileSize,
    };
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
