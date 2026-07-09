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

@Controller('workspaces')
@UseGuards(SessionAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly boardsService: BoardsService,

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
  update(
    @Param('workspaceId') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.update(+id, updateWorkspaceDto);
  }

  @Delete(':workspaceId')
  remove(@Param('id') id: string) {
    return this.workspaceService.remove(+id);
  }
}
