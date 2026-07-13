import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { BoardsService } from 'src/boards/boards.service';
import { WorkspaceMemberGuard } from 'src/auth/guards/permission.guard';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { WorkspaceAccessService } from './workspace-access.service';

@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly boardsService: BoardsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Post()
  create(
    @Body() createWorkspaceDto: CreateWorkspaceDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.workspaceService.create(createWorkspaceDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: SessionUser) {
    return this.workspaceService.findAll(user.id);
  }

  @Get(':workspaceId/boards')
  findAllBoards(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser
  ) {
    return this.boardsService.findAll(workspaceId, user.id);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  findOne(
    @Param('workspaceId') id: string,
    @CurrentUser() user: SessionUser
) {
    return this.workspaceService.findOne(+id, user.id);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  async update(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
    @CurrentUser() user: SessionUser,
  ) {
    await this.workspaceAccessService.requireOwner(workspaceId, user.id);
    return this.workspaceService.update(workspaceId, updateWorkspaceDto);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  async remove(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @CurrentUser() user: SessionUser,
  ) {
    await this.workspaceAccessService.requireOwner(workspaceId, user.id);
    return this.workspaceService.remove(workspaceId);
  }
}
