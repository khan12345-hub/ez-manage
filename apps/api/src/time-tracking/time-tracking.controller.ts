import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { TimeTrackingService } from './time-tracking.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { SessionAuthGuard } from 'src/auth/guards/session.guard';
import { PrismaService } from 'prisma/prisma.service';

// Board-level route for time report export
@SkipThrottle()
@Controller('boards/:boardId/time-entries')
@UseGuards(SessionAuthGuard)
export class TimeTrackingBoardController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Get('summary')
  getBoardTimeSummary(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.getBoardTimeSummary(boardId, user.id);
  }

  @Get('export')
  async exportTimeReport(
    @Param('boardId', ParseIntPipe) boardId: number,
    @CurrentUser() user: SessionUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const { csv, filename } = await this.timeTrackingService.exportTimeReport(boardId, user.id, {
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
@SkipThrottle()
@Controller('time-entries')
@UseGuards(SessionAuthGuard)
export class TimeTrackingGlobalController {
  constructor(
    private readonly timeTrackingService: TimeTrackingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('my-active')
  getMyActiveTimer(@CurrentUser() user: SessionUser) {
    return this.timeTrackingService.getMyActiveTimer(user.id);
  }

  @Get('my-timesheet')
  async getPersonalTimesheet(
    @CurrentUser() user: SessionUser,
    @Query('workspaceId') workspaceId: string,
    @Query('weekStart') weekStart: string,
  ) {
    let numId = parseInt(workspaceId, 10);
    if (!Number.isInteger(numId) || numId <= 0 || String(numId) !== workspaceId) {
      const ws = await this.prisma.workspace.findUnique({ where: { uid: workspaceId }, select: { id: true } });
      if (!ws) throw new NotFoundException('Workspace not found.');
      numId = ws.id;
    }
    return this.timeTrackingService.getPersonalTimesheet(user.id, numId, weekStart);
  }
}

@SkipThrottle()
@Controller('boards/:boardId/tasks/:taskId/time-entries')
@UseGuards(SessionAuthGuard)
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Get()
  getEntries(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.getEntries(boardId, taskId, user.id);
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
    @Param('boardId', ParseIntPipe) boardId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: SessionUser,
  ) {
    return this.timeTrackingService.getActiveTimer(taskId, user.id, boardId);
  }
}
