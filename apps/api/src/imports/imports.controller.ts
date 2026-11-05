import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ImportsService } from './imports.service';
import { BoardAccessService } from 'src/boards/board-access.service';

import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';

@Controller('imports')
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly boardAccessService: BoardAccessService,
  ) {}

  @Post('excel')
  @UseInterceptors(FileInterceptor('file'))
  async importBoard(
    @UploadedFile()
    file: Express.Multer.File,

    @Body('workspaceId')
    workspaceId: string,

    @Body('name')
    name: string,

    @Body('visibility')
    visibility: 'PUBLIC' | 'PRIVATE',
    @CurrentUser() user: SessionUser,


  ) {
    // Only active workspace OWNER/ADMIN/MEMBER (or super admin) may create boards here.
    await this.boardAccessService.assertCanCreateBoard(Number(workspaceId), user.id);
    return this.importsService.uploadBoardImportFile(
      user.id,
      Number(workspaceId),
      visibility,
      file,
    );
  }
}
