import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TimeTrackingService } from './time-tracking.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';

// Board-level route for time report export
@Controller('boards/:boardId/time-entries')
@UseGuards(SessionAuthGuard)
export class TimeTrackingBoardController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Get('export')
  async exportTimeReport(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { csv, filename } = await this.timeTrackingService.exportTimeReport(boardId, {
      startDate,
      endDate,
      userId: userId ? Number(userId) : undefined,
    });
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}

// Global route — returns current user's active timer across all boards
@Controller('time-entries')
export class TimeTrackingGlobalController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Get('my-active')
  getMyActiveTimer(@CurrentUser() user: SessionUser) {
    return this.timeTrackingService.getMyActiveTimer(user.id);
  }
}

@Controller('boards/:boardId/tasks/:taskId/time-entries')
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Get()
  getEntries(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.timeTrackingService.getEntries(boardId, taskId);
  }

  @Post('start')
  startTimer(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { note?: string },
  ) {
    return this.timeTrackingService.startTimer(boardId, taskId, user.id, body.note);
  }

  @Post('stop')
  stopTimer(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.stopTimer(boardId, taskId, user.id);
  }

  @Post('manual')
  logManual(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
    @Body() body: { durationMs: number; note?: string; startedAt?: string },
  ) {
    return this.timeTrackingService.logManual(
      boardId,
      taskId,
      user.id,
      body.durationMs,
      body.note,
      body.startedAt ? new Date(body.startedAt) : undefined,
    );
  }

  @Delete(':entryId')
  deleteEntry(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.deleteEntry(boardId, taskId, entryId, user.id);
  }

  @Get('active')
  getActiveTimer(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.getActiveTimer(taskId, user.id);
  }
}
