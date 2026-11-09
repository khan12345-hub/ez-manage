import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkFilesService } from './work-files.service';
import { WorkService } from './work.service';


/**
 * Task & comment extras (ClickUp): assign / follow / mark unread on a comment,
 * follow / favourite / duplicate a task, and Tasks in Multiple Lists.
 */
@Injectable()
export class WorkExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly files: WorkFilesService,
    private readonly work: WorkService,
  ) {}

  private async comment(commentId: number) {
    const c = await this.prisma.workComment.findFirst({ where: { id: commentId, deletedAt: null }, select: { id: true, taskId: true, content: true, parentId: true } });
    if (!c) throw new NotFoundException('Comment not found.');
    return c;
  }

  /* ── comments ── */

  async assignComment(commentId: number, userId: number, assigneeId: number | null) {
    const c = await this.comment(commentId);
    const { access } = await this.access.requireTask(c.taskId, userId, 'edit');
    if (assigneeId !== null && !(await this.access.areMembers(access.workspaceId, [assigneeId]))) {
      throw new BadRequestException('Comments can only be assigned to workspace members.');
    }
    await this.prisma.workComment.update({ where: { id: commentId }, data: { assigneeId, resolvedAt: null } });
    if (assigneeId) {
      const snippet = c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content;
      await this.files.notify(c.taskId, userId, [assigneeId], NotificationType.COMMENT_CREATED, 'A comment was assigned to you', snippet, { commentId, assignedComment: true, event: 'assigned_comment' });
    }
    return { id: commentId, assigneeId };
  }

  /** put the comment back in my Inbox as unread */
  async markCommentUnread(commentId: number, userId: number) {
    const c = await this.comment(commentId);
    await this.access.requireTask(c.taskId, userId, 'view');
    const existing = await this.prisma.notification.findFirst({
      where: { recipientId: userId, product: 'work', metadata: { path: ['commentId'], equals: commentId } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.notification.update({ where: { id: existing.id }, data: { isRead: false, readAt: null, clearedAt: null, snoozedUntil: null } });
    } else {
      const snippet = c.content.length > 140 ? `${c.content.slice(0, 140)}…` : c.content;
      await this.files.notifySystem(c.taskId, [userId], NotificationType.COMMENT_CREATED, 'Comment', snippet, { commentId, event: 'comment' });
    }
    return { ok: true };
  }

  async followComment(commentId: number, userId: number, on: boolean) {
    const c = await this.comment(commentId);
    await this.access.requireTask(c.taskId, userId, 'view');
    const root = c.parentId ?? c.id;
    if (on) await this.prisma.workCommentFollow.upsert({ where: { commentId_userId: { commentId: root, userId } }, create: { commentId: root, userId }, update: {} });
    else await this.prisma.workCommentFollow.deleteMany({ where: { commentId: root, userId } });
    return { commentId: root, following: on };
  }

  /* ── task: me ── */

  async mine(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    const [watch, fav, follows] = await Promise.all([
      this.prisma.workTaskWatch.findUnique({ where: { taskId_userId: { taskId, userId } } }),
      this.prisma.workFavorite.findUnique({ where: { userId_taskId: { userId, taskId } } }),
      this.prisma.workCommentFollow.findMany({ where: { userId, comment: { taskId } }, select: { commentId: true } }),
    ]);
    return { following: !watch?.muted, favorite: !!fav, followedComments: follows.map((f) => f.commentId) };
  }

  async setWatch(taskId: number, userId: number, following: boolean) {
    await this.access.requireTask(taskId, userId, 'view');
    await this.prisma.workTaskWatch.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId, muted: !following },
      update: { muted: !following },
    });
    return this.mine(taskId, userId);
  }

  async setFavorite(taskId: number, userId: number, on: boolean) {
    await this.access.requireTask(taskId, userId, 'view');
    if (on) await this.prisma.workFavorite.upsert({ where: { userId_taskId: { userId, taskId } }, create: { userId, taskId }, update: {} });
    else await this.prisma.workFavorite.deleteMany({ where: { userId, taskId } });
    return this.mine(taskId, userId);
  }

  async favorites(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workFavorite.findMany({
      where: { userId, task: { archivedAt: null, list: { archivedAt: null, space: { workspaceId, archivedAt: null, ...this.access.visibleSpaces(ws, userId) } } } },
      orderBy: { createdAt: 'desc' },
      select: { task: { select: { id: true, uid: true, name: true, list: { select: { uid: true, name: true } } } } },
    });
    return rows.map((r) => r.task);
  }

  /* ── task: duplicate ── */

  async duplicate(taskId: number, userId: number) {
    const { task } = await this.access.requireTask(taskId, userId, 'edit');
    const t = await this.prisma.workTask.findUniqueOrThrow({
      where: { id: task.id },
      select: {
        name: true, description: true, priority: true, statusId: true, startDate: true, dueDate: true, timeEstimate: true, parentId: true,
        assignees: { select: { userId: true } },
        tags: { select: { tagId: true } },
      },
    });
    const copy = await this.work.createTask(task.listId, userId, {
      name: `${t.name} (copy)`.slice(0, 500),
      description: t.description ?? undefined,
      priority: (t.priority ?? undefined) as any,
      statusId: t.statusId ?? undefined,
      startDate: t.startDate?.toISOString(),
      dueDate: t.dueDate?.toISOString(),
      parentId: t.parentId ?? undefined,
      assigneeIds: t.assignees.map((a) => a.userId),
      tagIds: t.tags.map((x) => x.tagId),
    } as any);
    if (t.timeEstimate) await this.prisma.workTask.update({ where: { id: (copy as any).id }, data: { timeEstimate: t.timeEstimate } });
    return copy;
  }

  /* ── Tasks in Multiple Lists ── */

  private async listsOf(taskId: number) {
    const rows = await this.prisma.workTaskList.findMany({
      where: { taskId, list: { archivedAt: null } },
      orderBy: { createdAt: 'asc' },
      select: { list: { select: { id: true, uid: true, name: true, space: { select: { id: true, name: true, color: true } }, folder: { select: { name: true } } } } },
    });
    return rows.map((r) => r.list);
  }

  async otherLists(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    return this.listsOf(taskId);
  }

  async addToList(taskId: number, userId: number, listId: number) {
    const { task, access } = await this.access.requireTask(taskId, userId, 'edit');
    const target = await this.access.requireList(listId, userId, 'edit');
    if (target.access.workspaceId !== access.workspaceId) throw new BadRequestException('That list is in another workspace.');
    if (listId === task.listId) throw new BadRequestException('The task already lives in this list.');
    const t = await this.prisma.workTask.findUniqueOrThrow({ where: { id: taskId }, select: { parentId: true } });
    if (t.parentId) throw new BadRequestException('Only top-level tasks can be added to other lists.');
    await this.prisma.workTaskList.upsert({ where: { taskId_listId: { taskId, listId } }, create: { taskId, listId, addedById: userId }, update: {} });
    return this.listsOf(taskId);
  }

  async removeFromList(taskId: number, userId: number, listId: number) {
    await this.access.requireTask(taskId, userId, 'edit');
    await this.prisma.workTaskList.deleteMany({ where: { taskId, listId } });
    return this.listsOf(taskId);
  }

  /** "Set as home List": the task moves there (statuses follow that list); the old home stays as an extra list */
  async setHome(taskId: number, userId: number, listId: number) {
    const { task } = await this.access.requireTask(taskId, userId, 'edit');
    const row = await this.prisma.workTaskList.findUnique({ where: { taskId_listId: { taskId, listId } } });
    if (!row) throw new BadRequestException('The task is not in that list.');
    const oldHome = task.listId;
    await this.work.updateTask(taskId, userId, { listId } as any);
    await this.prisma.$transaction([
      this.prisma.workTaskList.deleteMany({ where: { taskId, listId } }),
      this.prisma.workTaskList.upsert({ where: { taskId_listId: { taskId, listId: oldHome } }, create: { taskId, listId: oldHome, addedById: userId }, update: {} }),
    ]);
    return this.listsOf(taskId);
  }
}

