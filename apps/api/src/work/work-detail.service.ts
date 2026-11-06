import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import {
  CreateChecklistDto,
  CreateChecklistItemDto,
  CreateLinkDto,
  CreateTagDto,
  ManualTimeDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
} from './dto/work.dto';

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;

/**
 * Task-detail features of Work: tags, checklists, task links (dependencies),
 * time tracking, assigned-comment resolution and the activity history.
 */
@Injectable()
export class WorkDetailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
  ) {}

  /** Append to a task's history (shown with comments in the timeline). */
  async log(
    taskId: number,
    userId: number,
    action: string,
    fromValue?: unknown,
    toValue?: unknown,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await tx.workActivity.create({
      data: {
        taskId,
        userId,
        action,
        fromValue: fromValue === undefined ? Prisma.JsonNull : (fromValue as Prisma.InputJsonValue),
        toValue: toValue === undefined ? Prisma.JsonNull : (toValue as Prisma.InputJsonValue),
      },
    });
  }

  private async assertMember(workspaceId: number, userId: number | null | undefined) {
    if (!userId) return;
    const ok = await this.prisma.workspaceMember.count({ where: { workspaceId, userId, deletedAt: null } });
    if (!ok) throw new BadRequestException('That person is not a member of this workspace.');
  }

  /* ─────────────────────────────── tags ─────────────────────────────── */

  async listTags(spaceId: number, userId: number) {
    await this.access.requireSpace(spaceId, userId, 'view');
    return this.prisma.workTag.findMany({ where: { spaceId }, orderBy: { name: 'asc' } });
  }

  async createTag(spaceId: number, userId: number, dto: CreateTagDto) {
    await this.access.requireSpace(spaceId, userId, 'edit');
    const name = dto.name.trim();
    const existing = await this.prisma.workTag.findUnique({ where: { spaceId_name: { spaceId, name } } });
    if (existing) return existing;
    return this.prisma.workTag.create({ data: { spaceId, name, color: dto.color } });
  }

  async deleteTag(tagId: number, userId: number) {
    const tag = await this.prisma.workTag.findUnique({ where: { id: tagId }, select: { spaceId: true } });
    if (!tag) throw new NotFoundException('Tag not found.');
    await this.access.requireSpace(tag.spaceId, userId, 'manage');
    await this.prisma.workTag.delete({ where: { id: tagId } });
    return { deleted: true };
  }

  /* ──────────────────────────── checklists ──────────────────────────── */

  async createChecklist(taskId: number, userId: number, dto: CreateChecklistDto) {
    await this.access.requireTask(taskId, userId, 'edit');
    const last = await this.prisma.workChecklist.findFirst({ where: { taskId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.workChecklist.create({
      data: { taskId, name: dto.name.trim(), order: (last?.order ?? 0) + 1000 },
      include: { items: true },
    });
  }

  private async checklistScope(checklistId: number, userId: number) {
    const cl = await this.prisma.workChecklist.findUnique({ where: { id: checklistId }, select: { id: true, taskId: true } });
    if (!cl) throw new NotFoundException('Checklist not found.');
    const { access } = await this.access.requireTask(cl.taskId, userId, 'edit');
    return { cl, access };
  }

  async updateChecklist(checklistId: number, userId: number, dto: UpdateChecklistDto) {
    await this.checklistScope(checklistId, userId);
    return this.prisma.workChecklist.update({
      where: { id: checklistId },
      data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.order !== undefined && { order: dto.order }) },
    });
  }

  async deleteChecklist(checklistId: number, userId: number) {
    await this.checklistScope(checklistId, userId);
    await this.prisma.workChecklist.delete({ where: { id: checklistId } });
    return { deleted: true };
  }

  async addChecklistItem(checklistId: number, userId: number, dto: CreateChecklistItemDto) {
    const { access } = await this.checklistScope(checklistId, userId);
    await this.assertMember(access.workspaceId, dto.assigneeId);
    const last = await this.prisma.workChecklistItem.findFirst({ where: { checklistId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.workChecklistItem.create({
      data: { checklistId, name: dto.name.trim(), assigneeId: dto.assigneeId ?? null, order: (last?.order ?? 0) + 1000 },
      include: { assignee: { select: USER_MINI } },
    });
  }

  async updateChecklistItem(itemId: number, userId: number, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.workChecklistItem.findUnique({ where: { id: itemId }, select: { checklistId: true } });
    if (!item) throw new NotFoundException('Checklist item not found.');
    const { access } = await this.checklistScope(item.checklistId, userId);
    if (dto.assigneeId) await this.assertMember(access.workspaceId, dto.assigneeId);
    return this.prisma.workChecklistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.done !== undefined && { done: dto.done }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      include: { assignee: { select: USER_MINI } },
    });
  }

  async deleteChecklistItem(itemId: number, userId: number) {
    const item = await this.prisma.workChecklistItem.findUnique({ where: { id: itemId }, select: { checklistId: true } });
    if (!item) throw new NotFoundException('Checklist item not found.');
    await this.checklistScope(item.checklistId, userId);
    await this.prisma.workChecklistItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  /* ───────────────────── links / dependencies ───────────────────── */

  async addLink(taskId: number, userId: number, dto: CreateLinkDto) {
    const { access } = await this.access.requireTask(taskId, userId, 'edit');
    if (dto.taskId === taskId) throw new BadRequestException('A task cannot depend on itself.');
    // the other task must be visible to this user and in the same workspace
    const other = await this.access.requireTask(dto.taskId, userId, 'view');
    if (other.access.workspaceId !== access.workspaceId) throw new BadRequestException('Tasks must be in the same workspace.');
    // BLOCKING is stored as the reverse WAITING_ON
    const [fromId, toId, type] =
      dto.type === 'BLOCKING' ? [dto.taskId, taskId, 'WAITING_ON' as const] : [taskId, dto.taskId, dto.type];
    if (type === 'WAITING_ON') {
      const reverse = await this.prisma.workTaskLink.findFirst({ where: { fromId: toId, toId: fromId, type: 'WAITING_ON' } });
      if (reverse) throw new BadRequestException('These tasks already depend on each other the other way round.');
    }
    try {
      const link = await this.prisma.workTaskLink.create({ data: { fromId, toId, type } });
      await this.log(taskId, userId, 'link', undefined, { type: dto.type, taskId: dto.taskId });
      return link;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('This link already exists.');
      throw e;
    }
  }

  async removeLink(linkId: number, userId: number) {
    const link = await this.prisma.workTaskLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Link not found.');
    await this.access.requireTask(link.fromId, userId, 'edit');
    await this.prisma.workTaskLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  /* ──────────────────────────── time tracking ──────────────────────────── */

  private secondsOf(e: { startedAt: Date; endedAt: Date | null; duration: number | null }) {
    if (e.duration != null) return e.duration;
    return Math.max(0, Math.round(((e.endedAt ?? new Date()).getTime() - e.startedAt.getTime()) / 1000));
  }

  async listTime(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    const entries = await this.prisma.workTimeEntry.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, endedAt: true, duration: true, note: true, billable: true, user: { select: USER_MINI } },
    });
    const total = entries.reduce((s, e) => s + this.secondsOf(e), 0);
    return { totalSeconds: total, entries: entries.map((e) => ({ ...e, seconds: this.secondsOf(e), running: !e.endedAt })) };
  }

  /** The current user's running timer anywhere (for the top-bar widget). */
  async myRunning(userId: number) {
    const e = await this.prisma.workTimeEntry.findFirst({
      where: { userId, endedAt: null },
      select: { id: true, startedAt: true, task: { select: { id: true, uid: true, name: true, list: { select: { uid: true, space: { select: { workspaceId: true } } } } } } },
    });
    return e ?? null;
  }

  private async stopRunning(userId: number) {
    const running = await this.prisma.workTimeEntry.findFirst({ where: { userId, endedAt: null } });
    if (!running) return null;
    const endedAt = new Date();
    return this.prisma.workTimeEntry.update({
      where: { id: running.id },
      data: { endedAt, duration: Math.max(1, Math.round((endedAt.getTime() - running.startedAt.getTime()) / 1000)) },
    });
  }

  async startTimer(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'edit');
    await this.stopRunning(userId); // one running timer per user, like ClickUp
    return this.prisma.workTimeEntry.create({ data: { taskId, userId, startedAt: new Date() } });
  }

  async stopTimer(userId: number) {
    const stopped = await this.stopRunning(userId);
    if (!stopped) throw new BadRequestException('No timer is running.');
    return stopped;
  }

  async addManualTime(taskId: number, userId: number, dto: ManualTimeDto) {
    await this.access.requireTask(taskId, userId, 'edit');
    const startedAt = new Date(dto.startedAt);
    if (startedAt.getTime() > Date.now()) throw new BadRequestException('Time entries cannot start in the future.');
    return this.prisma.workTimeEntry.create({
      data: {
        taskId,
        userId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + dto.duration * 1000),
        duration: dto.duration,
        note: dto.note,
        billable: dto.billable ?? false,
      },
    });
  }

  async deleteTime(entryId: number, userId: number) {
    const e = await this.prisma.workTimeEntry.findUnique({ where: { id: entryId }, select: { userId: true, taskId: true } });
    if (!e) throw new NotFoundException('Time entry not found.');
    const { access } = await this.access.requireTask(e.taskId, userId, 'view');
    if (e.userId !== userId && !access.canManage) throw new ForbiddenException('You can only delete your own time entries.');
    await this.prisma.workTimeEntry.delete({ where: { id: entryId } });
    return { deleted: true };
  }

  /* ─────────────────────── assigned comments ─────────────────────── */

  async setCommentResolved(commentId: number, userId: number, resolved: boolean) {
    const c = await this.prisma.workComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { id: true, taskId: true, userId: true, assigneeId: true },
    });
    if (!c) throw new NotFoundException('Comment not found.');
    const { access } = await this.access.requireTask(c.taskId, userId, 'view');
    if (!c.assigneeId) throw new BadRequestException('This comment is not assigned to anyone.');
    if (userId !== c.assigneeId && userId !== c.userId && !access.canManage) {
      throw new ForbiddenException('Only the assignee or the author can resolve this comment.');
    }
    return this.prisma.workComment.update({ where: { id: commentId }, data: { resolvedAt: resolved ? new Date() : null } });
  }

  /** Assigned comments for the current user: to me (open) and delegated by me. */
  async assignedComments(workspaceId: number, userId: number, mode: 'to-me' | 'by-me', includeResolved: boolean) {
    await this.access.requireWorkspace(workspaceId, userId, 'view');
    return this.prisma.workComment.findMany({
      where: {
        deletedAt: null,
        assigneeId: mode === 'to-me' ? userId : { not: null },
        ...(mode === 'by-me' ? { userId } : {}),
        ...(includeResolved ? {} : { resolvedAt: null }),
        task: { archivedAt: null, list: { archivedAt: null, space: { workspaceId, archivedAt: null } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, content: true, createdAt: true, resolvedAt: true,
        user: { select: USER_MINI }, assignee: { select: USER_MINI },
        task: { select: { id: true, uid: true, name: true, list: { select: { uid: true, name: true } } } },
      },
    });
  }

  /* ─────────────────────────────── activity ─────────────────────────────── */

  async activity(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    return this.prisma.workActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      take: 300,
      select: { id: true, action: true, fromValue: true, toValue: true, createdAt: true, user: { select: USER_MINI } },
    });
  }
}
