import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';

@Controller('admin')
@UseGuards(SessionAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('workspaces')
  getAllWorkspaces() {
    return this.adminService.getAllWorkspaces();
  }

  @Delete('workspaces/:id')
  deleteWorkspace(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteWorkspace(id);
  }

  @Get('boards')
  getAllBoards() {
    return this.adminService.getAllBoards();
  }

  @Delete('boards/:id')
  deleteBoard(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteBoard(id);
  }

  @Get('files')
  getAllFiles() {
    return this.adminService.getAllFiles();
  }

  @Delete('files/:id')
  deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteFile(id);
  }
}
