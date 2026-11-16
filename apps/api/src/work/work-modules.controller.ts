import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkService } from './work.service';
import { WorkTimesheetService } from './work-timesheet.service';

/** Work modules: Timesheets, Sprints, Goals, Docs, Forms, Whiteboards (session auth is global). */
@Controller('work')
export class WorkModulesController {
  constructor(
    private readonly work: WorkService,
    private readonly timesheets: WorkTimesheetService,
  ) {}

  // ── timesheets ──
  @Get('workspaces/:workspaceId/timesheet')
  async timesheet(@Param('workspaceId') ws: string, @Query('week') week: string, @Query('tz') tz: string, @Query('userId') userId: string, @CurrentUser() u: SessionUser) {
    return this.timesheets.mine(await this.work.resolveWorkspaceId(ws), u.id, String(week ?? ''), Number(tz ?? 0), /^\d+$/.test(userId ?? '') ? Number(userId) : undefined);
  }

  @Get('workspaces/:workspaceId/timesheet/team')
  async teamTimesheet(@Param('workspaceId') ws: string, @Query('week') week: string, @Query('tz') tz: string, @CurrentUser() u: SessionUser) {
    return this.timesheets.team(await this.work.resolveWorkspaceId(ws), u.id, String(week ?? ''), Number(tz ?? 0));
  }
}
