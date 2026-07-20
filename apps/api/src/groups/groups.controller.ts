import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ReorderGroupDto } from './dto/reorder-group.dto';
import { BoardAccessService } from 'src/boards/board-access.service';
import { SessionUser } from 'src/auth/types/session-user.type';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { DeleteGroupDto } from './dto/delete-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly boardsAccessService: BoardAccessService,
  ) {}

  @Post()
  create(
    @Body() createGroupDto: CreateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    const isMember = this.boardsAccessService.requireViewer(
      createGroupDto.boardId,
      user.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        `Board not found or you don't have valid permission`,
      );
    }
    return this.groupsService.create(createGroupDto, user.id);
  }

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(+id);
  }

  @Patch('reorder')
  reorder(
    @Body() dto: ReorderGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    const isMember = this.boardsAccessService.requireViewer(
      dto.boardId,
      user.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        `Board not found or you don't have valid permission`,
      );
    }
    return this.groupsService.reorder(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.groupsService.update(+id, updateGroupDto, user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() deleteGroupDto: DeleteGroupDto,
    @CurrentUser() user: SessionUser,

  ) {
    return this.groupsService.remove(+id, deleteGroupDto.boardId, user.id);
  }
}
