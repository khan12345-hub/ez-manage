import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { SessionUser } from 'src/auth/types/session-user.type';
import { WorkService } from './work.service';
import { WorkTimesheetService } from './work-timesheet.service';
import { WorkSprintsService } from './work-sprints.service';
import { WorkGoalsService } from './work-goals.service';
import { WorkDocsService } from './work-docs.service';
import { WorkFormsService } from './work-forms.service';
import { WorkAiService } from './work-ai.service';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/decorators/public.decorator';

/** Work modules: Timesheets, Sprints, Goals, Docs, Forms, Whiteboards (session auth is global). */
@Controller('work')
export class WorkModulesController {
  constructor(
    private readonly work: WorkService,
    private readonly timesheets: WorkTimesheetService,
    private readonly sprints: WorkSprintsService,
    private readonly goals: WorkGoalsService,
    private readonly docs: WorkDocsService,
    private readonly forms: WorkFormsService,
    private readonly ai: WorkAiService,
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

  // ── sprints ──
  @Get('workspaces/:workspaceId/sprints')
  async listSprints(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.sprints.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/sprints')
  async createSprint(@Param('workspaceId') ws: string, @Body() b: { name?: string; goal?: string; startDate?: string; endDate?: string }, @CurrentUser() u: SessionUser) {
    return this.sprints.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Get('sprints/:id')
  sprint(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.sprints.detail(id, u.id);
  }

  @Patch('sprints/:id')
  updateSprint(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; goal?: string | null; startDate?: string; endDate?: string; status?: string }, @CurrentUser() u: SessionUser) {
    return this.sprints.update(id, u.id, b ?? {});
  }

  @Post('sprints/:id/tasks')
  sprintTasks(@Param('id', ParseIntPipe) id: number, @Body() b: { add?: number[]; remove?: number[] }, @CurrentUser() u: SessionUser) {
    return this.sprints.setTasks(id, u.id, Array.isArray(b?.add) ? b.add : [], Array.isArray(b?.remove) ? b.remove : []);
  }

  @Post('sprints/:id/complete')
  completeSprint(@Param('id', ParseIntPipe) id: number, @Body() b: { moveTo?: number | null }, @CurrentUser() u: SessionUser) {
    return this.sprints.complete(id, u.id, b?.moveTo ? Number(b.moveTo) : null);
  }

  @Delete('sprints/:id')
  deleteSprint(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.sprints.remove(id, u.id);
  }

  // ── goals ──
  @Get('workspaces/:workspaceId/goals')
  async listGoals(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.goals.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/goals')
  async createGoal(@Param('workspaceId') ws: string, @Body() b: { name?: string; description?: string; dueDate?: string | null; ownerId?: number; color?: string }, @CurrentUser() u: SessionUser) {
    return this.goals.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Patch('goals/:id')
  updateGoal(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; description?: string | null; dueDate?: string | null; ownerId?: number; color?: string }, @CurrentUser() u: SessionUser) {
    return this.goals.update(id, u.id, b ?? {});
  }

  @Delete('goals/:id')
  deleteGoal(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.goals.remove(id, u.id);
  }

  @Post('goals/:id/targets')
  addGoalTarget(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; kind?: string; startVal?: number; targetVal?: number; unit?: string; listId?: number }, @CurrentUser() u: SessionUser) {
    return this.goals.addTarget(id, u.id, b ?? {});
  }

  @Patch('goal-targets/:id')
  updateGoalTarget(@Param('id', ParseIntPipe) id: number, @Body() b: { current?: number; name?: string; targetVal?: number; startVal?: number }, @CurrentUser() u: SessionUser) {
    return this.goals.updateTarget(id, u.id, b ?? {});
  }

  @Delete('goal-targets/:id')
  deleteGoalTarget(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.goals.removeTarget(id, u.id);
  }

  // ── docs ──
  @Get('workspaces/:workspaceId/docs')
  async listDocs(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.docs.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/docs')
  async createDoc(@Param('workspaceId') ws: string, @Body() b: { title?: string; spaceId?: number | null; parentId?: number | null; content?: string }, @CurrentUser() u: SessionUser) {
    return this.docs.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Get('docs/:id')
  doc(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.docs.get(id, u.id);
  }

  @Patch('docs/:id')
  updateDoc(@Param('id') id: string, @Body() b: { title?: string; content?: string }, @CurrentUser() u: SessionUser) {
    return this.docs.update(id, u.id, b ?? {});
  }

  @Delete('docs/:id')
  archiveDoc(@Param('id') id: string, @CurrentUser() u: SessionUser) {
    return this.docs.archive(id, u.id);
  }

  // ── forms ──
  @Get('workspaces/:workspaceId/forms')
  async listForms(@Param('workspaceId') ws: string, @CurrentUser() u: SessionUser) {
    return this.forms.list(await this.work.resolveWorkspaceId(ws), u.id);
  }

  @Post('workspaces/:workspaceId/forms')
  async createForm(@Param('workspaceId') ws: string, @Body() b: { name?: string; description?: string; listId?: number; fields?: unknown }, @CurrentUser() u: SessionUser) {
    return this.forms.create(await this.work.resolveWorkspaceId(ws), u.id, b ?? {});
  }

  @Patch('forms/:id')
  updateForm(@Param('id', ParseIntPipe) id: number, @Body() b: { name?: string; description?: string | null; listId?: number; fields?: unknown; active?: boolean }, @CurrentUser() u: SessionUser) {
    return this.forms.update(id, u.id, b ?? {});
  }

  @Delete('forms/:id')
  deleteForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: SessionUser) {
    return this.forms.remove(id, u.id);
  }

  /** public: anyone with the link can open and submit (each answer becomes a task) */
  @Public()
  @Get('public/forms/:uid')
  publicForm(@Param('uid') uid: string) {
    return this.forms.publicForm(uid);
  }

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('public/forms/:uid')
  submitForm(@Param('uid') uid: string, @Body() b: { answers?: Record<string, unknown> }) {
    return this.forms.submit(uid, b?.answers ?? {});
  }

  // ── Work AI ──
  @Get('ai/status')
  aiStatus() {
    return this.ai.status();
  }

  @Post('tasks/:id/ai')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  taskAi(@Param('id', ParseIntPipe) id: number, @Body() b: { action?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.forTask(id, u.id, String(b?.action ?? ''));
  }

  @Post('workspaces/:workspaceId/ai/ask')
  @Throttle({ auth: { ttl: 60_000, limit: 20 } })
  async askAi(@Param('workspaceId') ws: string, @Body() b: { question?: string }, @CurrentUser() u: SessionUser) {
    return this.ai.ask(await this.work.resolveWorkspaceId(ws), u.id, String(b?.question ?? ''));
  }
}
