import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';

import { ActivityLogsService } from './activity-logs.service';
import { GetActivityLogsDto } from './dto/get-activity-log.dto';
import { BoardAccessService } from 'src/boards/board-access.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { BoardPermission } from '@repo/shared';
import { PrismaService } from 'prisma/prisma.service';

// Activity contains old/new cell values — only users who can VIEW the board
// may read it (previously any logged-in user could read any board's history).
@Controller()
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
    private readonly boardAccess: BoardAccessService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('boards/:boardId/activity')
  async findByBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query() query: GetActivityLogsDto,
    @CurrentUser() user: SessionUser,
  ) {
    await this.boardAccess.requirePermission(boardId, user.id, BoardPermission.VIEW);
    return this.activityLogsService.findByBoard(boardId, query);
  }

  @Get('tasks/:taskId/activity')
  async findByTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: GetActivityLogsDto,
    @CurrentUser() user: SessionUser,
  ) {
    await this.boardAccess.requireTaskPermission(taskId, user.id, BoardPermission.VIEW);
    return this.activityLogsService.findByTask(
      taskId,
      query.cursor,
      query.limit,
    );
  }

  @Get('activity/:id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ) {
    const log = await this.prisma.activityLog.findUnique({
      where: { id },
      select: { boardId: true },
    });
    if (!log) throw new NotFoundException('Activity not found.');
    await this.boardAccess.requirePermission(log.boardId, user.id, BoardPermission.VIEW);
    return this.activityLogsService.findOne(id);
  }
}
