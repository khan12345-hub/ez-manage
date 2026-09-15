import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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

  @Patch('workspaces/:id')
  updateWorkspace(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; visibility?: string },
  ) {
    return this.adminService.updateWorkspace(id, data);
  }

  @Delete('workspaces/:id')
  deleteWorkspace(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteWorkspace(id);
  }

  @Get('boards')
  getAllBoards() {
    return this.adminService.getAllBoards();
  }

  @Patch('boards/:id')
  updateBoard(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; visibility?: string },
  ) {
    return this.adminService.updateBoard(id, data);
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

  @Get('integrations')
  getIntegrations() {
    return this.adminService.getIntegrations();
  }

  @Patch('integrations')
  updateIntegrations(@Body() data: { mondayApiToken?: string }) {
    return this.adminService.updateIntegrations(data);
  }
}
