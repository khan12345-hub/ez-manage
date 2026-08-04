import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';

import { ActivityLogsService } from './activity-logs.service';
import { GetActivityLogsDto } from './dto/get-activity-log.dto';

@Controller()
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  // @Get("boards/:boardId/activity")
  // findByBoard(
  //   @Param("boardId", ParseIntPipe) boardId: number,
  //   @Query() query: GetActivityLogsDto,
  // ) {
  //   return this.activityLogsService.findByBoard(
  //     boardId,
  //     query.page,
  //     query.limit,
  //   );
  // }

  @Get('tasks/:taskId/activity')
  findByTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Query() query: GetActivityLogsDto,
  ) {
    return this.activityLogsService.findByTask(
      taskId,
      query.cursor,
      query.limit,
    );
  }

  @Get('activity/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.activityLogsService.findOne(id);
  }
}
