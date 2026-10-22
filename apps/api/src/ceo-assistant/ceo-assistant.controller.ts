import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/auth/types/session-user.type';
import { PrismaService } from 'prisma/prisma.service';

import { TaskAnalyzerService } from './services/task-analyzer.service';
import { EmailGeneratorService } from './services/email-generator.service';
import { EmailSenderService } from './services/email-sender.service';
import { TemplateService } from './services/template.service';
import { ManagementService } from './services/management.service';
import { CeoMeetingService } from './services/ceo-meeting.service';
import { CeoSettingsService } from './services/ceo-settings.service';

import { GetOverviewDto } from './dto/get-overview.dto';
import { GenerateEmailsDto } from './dto/generate-emails.dto';
import { SendEmailsDto } from './dto/send-emails.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { CreateMeetingDto, UpdateMeetingDto } from './dto/meeting.dto';

@Controller('ceo-assistant')
export class CeoAssistantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskAnalyzer: TaskAnalyzerService,
    private readonly emailGenerator: EmailGeneratorService,
    private readonly emailSender: EmailSenderService,
    private readonly templateService: TemplateService,
    private readonly managementService: ManagementService,
    private readonly meetingService: CeoMeetingService,
    private readonly settingsService: CeoSettingsService,
  ) {}

  // ─── Task Overview ──────────────────────────────────────────────────────────

  @Get('overview')
  async getOverview(@CurrentUser() user: SessionUser, @Query() dto: GetOverviewDto) {
    await this.requireAdminAccess(user.id);
    return this.taskAnalyzer.getOverview({
      userId: user.id,
      workspaceIds: dto.workspaceIds,
      inactivityDays: dto.inactivityDays ?? 3,
      upcomingDays: dto.upcomingDays ?? 7,
    });
  }

  // ─── Email Generation ───────────────────────────────────────────────────────

  @Post('generate-drafts')
  async generateDrafts(@CurrentUser() user: SessionUser, @Body() dto: GenerateEmailsDto) {
    await this.requireAdminAccess(user.id);

    const sender = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Management';

    const overview = await this.taskAnalyzer.getOverview({
      userId: user.id,
      inactivityDays: dto.inactivityDays ?? 3,
      upcomingDays: dto.upcomingDays ?? 7,
    });

    const targets = overview.employees.filter((e) => dto.employeeIds.includes(e.user.id));

    const drafts = await Promise.all(
      targets.map((employee) =>
        this.emailGenerator.generateDraft(employee, {
          tone: dto.tone ?? 'professional',
          categories: dto.categories ?? ['overdue', 'due_soon', 'inactive'],
          senderName,
        }),
      ),
    );

    return { drafts };
  }

  // ─── Send Emails ────────────────────────────────────────────────────────────

  @Post('send')
  async sendEmails(@CurrentUser() user: SessionUser, @Body() dto: SendEmailsDto) {
    await this.requireAdminAccess(user.id);

    const sender = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : 'Management';

    return this.emailSender.sendBulk({
      sentById: user.id,
      senderName,
      drafts: dto.drafts,
    });
  }

  // ─── Retry Failed Email ─────────────────────────────────────────────────────

  @Post('history/:id/retry')
  async retryEmail(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireAdminAccess(user.id);
    return this.emailSender.retryEmail(id, user.id);
  }

  // ─── Email History ──────────────────────────────────────────────────────────

  @Get('history')
  async getHistory(
    @CurrentUser() user: SessionUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    await this.requireAdminAccess(user.id);

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      this.prisma.ceoEmailHistory.findMany({
        where: { sentById: user.id },
        orderBy: { sentAt: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          subject: true,
          body: true,
          deliveryStatus: true,
          sentAt: true,
          recipient: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.ceoEmailHistory.count({ where: { sentById: user.id } }),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get('templates')
  getTemplates(@CurrentUser() user: SessionUser) {
    return this.templateService.findAll(user.id);
  }

  @Post('templates')
  createTemplate(@CurrentUser() user: SessionUser, @Body() dto: SaveTemplateDto) {
    return this.templateService.create(user.id, dto);
  }

  @Patch('templates/:id')
  updateTemplate(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<SaveTemplateDto>,
  ) {
    return this.templateService.update(id, user.id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    return this.templateService.remove(id, user.id);
  }

  // ─── Management Team ────────────────────────────────────────────────────────

  @Get('management')
  async getManagementTeam(@CurrentUser() user: SessionUser) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getManagementTeam(user.id);
  }

  @Get('management/search')
  async searchUsers(@CurrentUser() user: SessionUser, @Query('q') q: string) {
    await this.requireAdminAccess(user.id);
    return this.managementService.searchUsers(user.id, q ?? '');
  }

  @Get('management/member/:id')
  async getMemberDetail(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('inactivityDays') inactivityDays?: string,
    @Query('upcomingDays') upcomingDays?: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getMemberDetail(user.id, id, Number(inactivityDays ?? 3), Number(upcomingDays ?? 7));
  }

  @Get('management/:id')
  async getManagerDetail(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('inactivityDays') inactivityDays?: string,
    @Query('upcomingDays') upcomingDays?: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getManagerDetail(user.id, id, Number(inactivityDays ?? 3), Number(upcomingDays ?? 7));
  }

  @Post('management/add')
  async addToManagementTeam(@CurrentUser() user: SessionUser, @Body('memberId', ParseIntPipe) memberId: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.addToManagementTeam(user.id, memberId);
  }

  @Post('management/:id/hide')
  async hideMember(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.hideFromManagementTeam(user.id, id);
  }

  @Post('management/:id/show')
  async showMember(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.showInManagementTeam(user.id, id);
  }

  @Get('workspaces/:id/detail')
  async getWorkspaceDetail(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Query('inactivityDays') inactivityDays?: string,
    @Query('upcomingDays') upcomingDays?: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getWorkspaceDetail(user.id, id, Number(inactivityDays ?? 3), Number(upcomingDays ?? 7));
  }

  // ─── Task Detail (CEO Read-Only Panel) ──────────────────────────────────────

  @Get('tasks/:id')
  async getTaskDetail(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getTaskDetail(user.id, id);
  }

  @Post('tasks/:id/comment')
  async addComment(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.addCommentToTask(user.id, id, content);
  }

  @Post('tasks/:id/notify')
  async notifyAssignee(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('assigneeId', ParseIntPipe) assigneeId: number,
    @Body('message') message: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.sendTaskNotification(user.id, id, assigneeId, message);
  }

  @Post('tasks/:id/mark-done')
  async markTaskDone(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.markTaskDone(user.id, id);
  }

  @Post('tasks/:id/reassign')
  async reassignTask(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('assigneeId', ParseIntPipe) assigneeId: number,
  ) {
    await this.requireAdminAccess(user.id);
    return this.managementService.reassignTask(user.id, id, assigneeId);
  }

  @Get('tasks/:id/workspace-members')
  async getTaskWorkspaceMembers(@CurrentUser() user: SessionUser, @Param('id', ParseIntPipe) id: number) {
    await this.requireAdminAccess(user.id);
    return this.managementService.getTaskWorkspaceMembers(user.id, id);
  }

  // ─── Meetings ───────────────────────────────────────────────────────────────

  @Get('meetings')
  async getMeetings(
    @CurrentUser() user: SessionUser,
    @Query('upcoming') upcoming?: string,
  ) {
    await this.requireAdminAccess(user.id);
    return this.meetingService.getMeetings(user.id, upcoming !== 'false');
  }

  @Post('meetings')
  async createMeeting(@CurrentUser() user: SessionUser, @Body() dto: CreateMeetingDto) {
    await this.requireAdminAccess(user.id);
    return this.meetingService.createMeeting(user.id, dto);
  }

  @Patch('meetings/:id')
  async updateMeeting(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMeetingDto,
  ) {
    await this.requireAdminAccess(user.id);
    return this.meetingService.updateMeeting(user.id, id, dto);
  }

  @Delete('meetings/:id')
  async cancelMeeting(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.requireAdminAccess(user.id);
    return this.meetingService.cancelMeeting(user.id, id);
  }

  // ─── Dashboard Passphrase ───────────────────────────────────────────────────

  /** Returns whether a passphrase has been set (no sensitive data exposed) */
  @Get('settings/key-status')
  async getKeyStatus(@CurrentUser() user: SessionUser) {
    await this.requireAdminAccess(user.id);
    const hasKey = await this.settingsService.hasKey();
    return { hasKey };
  }

  /** CEO sets or updates the passphrase */
  @Post('settings/key')
  async setKey(@CurrentUser() user: SessionUser, @Body('key') key: string) {
    await this.requireAdminAccess(user.id);
    if (!key || key.length < 4) throw new ForbiddenException('Key must be at least 4 characters.');
    await this.settingsService.setKey(key);
    return { success: true };
  }

  /** Verify passphrase — OWNER required on role, key validated separately */
  @Post('unlock')
  async unlock(@CurrentUser() user: SessionUser, @Body('key') key: string) {
    await this.requireAdminAccess(user.id);
    const valid = await this.settingsService.verifyKey(key ?? '');
    if (!valid) throw new ForbiddenException('Invalid dashboard key.');
    return { success: true };
  }

  // ─── Guard ──────────────────────────────────────────────────────────────────

  private async requireAdminAccess(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    if (user?.systemRole !== 'SUPER_ADMIN') throw new ForbiddenException('CEO Assistant is restricted to Super Admins.');
  }
}
