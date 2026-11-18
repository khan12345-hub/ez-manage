import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkViewsService } from './work-views.service';

/** Saved views of a list / folder / space (shared, named, ordered). */
@Controller('work/views')
export class WorkViewsController {
  constructor(private readonly views: WorkViewsService) {}

  /** the Dashboards hub: every dashboard view in the workspace this person can open (?ws=<workspace uid>) */
  @Get('dashboards') dashboards(@Query('ws') ws: string, @CurrentUser() u: SessionUser) { return this.views.dashboards(ws, u.id); }
  @Get() list(@Query('type') type: string, @Query('ref') ref: string, @CurrentUser() u: SessionUser) { return this.views.list(type, ref, u.id); }
  @Post() create(@Body() b: any, @CurrentUser() u: SessionUser) { return this.views.create(u.id, b ?? {}); }
  @Patch(':uid') update(@Param('uid') uid: string, @Body() b: any, @CurrentUser() u: SessionUser) { return this.views.update(uid, u.id, b ?? {}); }
  @Post(':uid/move') move(@Param('uid') uid: string, @Body() b: { dir?: string }, @CurrentUser() u: SessionUser) { return this.views.move(uid, u.id, String(b?.dir ?? '')); }
  @Post(':uid/duplicate') duplicate(@Param('uid') uid: string, @CurrentUser() u: SessionUser) { return this.views.duplicate(uid, u.id); }
  @Delete(':uid') remove(@Param('uid') uid: string, @CurrentUser() u: SessionUser) { return this.views.remove(uid, u.id); }
}
