import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';
import { WorkDetailService } from './work-detail.service';
import {
  CreateCommentDto,
  CreateFolderDto,
  CreateListDto,
  CreateSpaceDto,
  CreateStatusDto,
  CreateTaskDto,
  UpdateCommentDto,
  UpdateFolderDto,
  UpdateListDto,
  UpdateSpaceDto,
  UpdateStatusDto,
  UpdateTaskDto,
} from './dto/work.dto';

const uid = () => randomBytes(9).toString('base64url').substring(0, 12);

/** Default statuses for a new space (ClickUp-style: To do → In progress → Complete). */
const DEFAULT_STATUSES = [
  { name: 'To do', color: '#9CA3AF', category: 'NOT_STARTED' as const, order: 1000 },
  { name: 'In progress', color: '#2563EB', category: 'ACTIVE' as const, order: 2000 },
  { name: 'Complete', color: '#16A34A', category: 'DONE' as const, order: 3000 },
];

const USER_MINI = { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } as const;

const TASK_SELECT = {
  id: true,
  uid: true,
  listId: true,
  statusId: true,
  parentId: true,
  name: true,
  priority: true,
  startDate: true,
  dueDate: true,
  order: true,
  completedAt: true,
  timeEstimate: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  assignees: { select: { user: { select: USER_MINI } } },
  tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
  _count: { select: { subtasks: { where: { archivedAt: null } }, comments: { where: { deletedAt: null } } } },
} as const;

type TaskRow = {
  assignees: { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null; email: string } }[];
  tags: { tag: { id: number; name: string; color: string } }[];
  _count: { subtasks: number; comments: number };
  [k: string]: unknown;
};
const shapeTask = (t: TaskRow) => {
  const { assignees, tags, _count, ...rest } = t;
  return {
    ...rest,
    assignees: assignees.map((a) => a.user),
    tags: tags.map((x) => x.tag),
    subtaskCount: _count.subtasks,
    commentCount: _count.comments,
  };
};

const LINKED_TASK = {
  id: true, uid: true, name: true, completedAt: true, archivedAt: true,
  status: { select: { name: true, color: true, category: true } },
  list: { select: { name: true } },
} as const;

const COMMENT_SELECT = {
  id: true, taskId: true, parentId: true, content: true, createdAt: true, updatedAt: true, resolvedAt: true,
  user: { select: USER_MINI }, assignee: { select: USER_MINI },
} as const;

const toDate = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : new Date(v));

@Injectable()
export class WorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
    private readonly detail: WorkDetailService,
  ) {}

  /* ─────────────────────────── helpers ─────────────────────────── */

  async resolveWorkspaceId(idOrUid: string): Promise<number> {
    const n = Number(idOrUid);
    const ws = Number.isInteger(n) && String(n) === idOrUid
      ? await this.prisma.workspace.findUnique({ where: { id: n }, select: { id: true } })
      : await this.prisma.workspace.findUnique({ where: { uid: idOrUid }, select: { id: true } });
    if (!ws) throw new NotFoundException('Workspace not found.');
    return ws.id;
  }

  /** Statuses a list uses: its own → its folder's → its space's. */
  async effectiveStatuses(list: { id: number; folderId: number | null; spaceId: number }) {
    const order = { order: 'asc' as const };
    const own = await this.prisma.workStatus.findMany({ where: { listId: list.id }, orderBy: order });
    if (own.length) return own;
    if (list.folderId) {
      const f = await this.prisma.workStatus.findMany({ where: { folderId: list.folderId }, orderBy: order });
      if (f.length) return f;
    }
    return this.prisma.workStatus.findMany({ where: { spaceId: list.spaceId }, orderBy: order });
  }

  private async assertAssignable(workspaceId: number, userIds: number[] | undefined) {
    if (!userIds?.length) return;
    const ids = [...new Set(userIds)];
    const n = await this.prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: ids }, deletedAt: null },
    });
    if (n !== ids.length) throw new BadRequestException('Assignees must be members of this workspace.');
  }

  /* ──────────────────────────── tree ───────────────────────────── */

  async tree(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const listSelect = {
      id: true, uid: true, name: true, color: true, order: true, folderId: true,
      _count: { select: { tasks: { where: { archivedAt: null, parentId: null, completedAt: null } } } },
    } as const;
    const spaces = await this.prisma.space.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        ...(ws.canManage ? {} : { OR: [{ isPrivate: false }, { members: { some: { userId } } }] }),
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: {
        id: true, uid: true, name: true, color: true, icon: true, isPrivate: true, order: true,
        folders: {
          where: { archivedAt: null },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          select: {
            id: true, uid: true, name: true, order: true,
            lists: { where: { archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: listSelect },
          },
        },
        lists: { where: { archivedAt: null, folderId: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: listSelect },
      },
    });
    const shapeList = (l: any) => ({ ...l, openTaskCount: l._count.tasks, _count: undefined });
    return {
      access: { canEdit: ws.canEdit, canManage: ws.canManage },
      spaces: spaces.map((s) => ({
        ...s,
        lists: s.lists.map(shapeList),
        folders: s.folders.map((f) => ({ ...f, lists: f.lists.map(shapeList) })),
      })),
    };
  }

  /* ─────────────────────────── spaces ──────────────────────────── */

  async createSpace(workspaceId: number, userId: number, dto: CreateSpaceDto) {
    await this.access.requireWorkspace(workspaceId, userId, 'manage');
    const last = await this.prisma.space.findFirst({ where: { workspaceId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.space.create({
      data: {
        uid: uid(),
        workspaceId,
        name: dto.name.trim(),
        color: dto.color ?? '#047857',
        icon: dto.icon,
        isPrivate: dto.isPrivate ?? false,
        order: (last?.order ?? 0) + 1000,
        createdById: userId,
        statuses: { create: DEFAULT_STATUSES },
        // the creator always keeps access to a private space
        ...(dto.isPrivate ? { members: { create: [{ userId }] } } : {}),
      },
    });
  }

  async updateSpace(spaceId: number, userId: number, dto: UpdateSpaceDto) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    return this.prisma.space.update({
      where: { id: spaceId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.isPrivate !== undefined && { isPrivate: dto.isPrivate }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async archiveSpace(spaceId: number, userId: number) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    await this.prisma.space.update({ where: { id: spaceId }, data: { archivedAt: new Date() } });
    return { archived: true };
  }

  async setSpaceMembers(spaceId: number, userId: number, userIds: number[]) {
    const a = await this.access.requireSpace(spaceId, userId, 'manage');
    await this.assertAssignable(a.workspaceId, userIds);
    const ids = [...new Set(userIds)];
    await this.prisma.$transaction([
      this.prisma.spaceMember.deleteMany({ where: { spaceId, userId: { notIn: ids } } }),
      this.prisma.spaceMember.createMany({ data: ids.map((u) => ({ spaceId, userId: u })), skipDuplicates: true }),
    ]);
    return { userIds: ids };
  }

  /* ────────────────────────── statuses ─────────────────────────── */

  async createSpaceStatus(spaceId: number, userId: number, dto: CreateStatusDto) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    const last = await this.prisma.workStatus.findFirst({ where: { spaceId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.workStatus.create({
      data: {
        spaceId,
        name: dto.name.trim(),
        color: dto.color,
        category: dto.category ?? 'ACTIVE',
        order: dto.order ?? (last?.order ?? 0) + 1000,
      },
    });
  }

  private async statusScope(statusId: number, userId: number) {
    const st = await this.prisma.workStatus.findUnique({
      where: { id: statusId },
      select: { id: true, spaceId: true, folderId: true, listId: true, folder: { select: { spaceId: true } }, list: { select: { spaceId: true } } },
    });
    if (!st) throw new NotFoundException('Status not found.');
    const spaceId = st.spaceId ?? st.folder?.spaceId ?? st.list?.spaceId;
    await this.access.requireSpace(spaceId!, userId, 'manage');
    return st;
  }

  async updateStatus(statusId: number, userId: number, dto: UpdateStatusDto) {
    await this.statusScope(statusId, userId);
    const updated = await this.prisma.workStatus.update({
      where: { id: statusId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
    if (dto.category !== undefined) {
      // keep completedAt in sync with the status group
      await this.prisma.workTask.updateMany({
        where: { statusId, completedAt: dto.category === 'DONE' ? null : { not: null } },
        data: { completedAt: dto.category === 'DONE' ? new Date() : null },
      });
    }
    return updated;
  }

  async deleteStatus(statusId: number, userId: number) {
    const st = await this.statusScope(statusId, userId);
    const owner = st.spaceId ? { spaceId: st.spaceId } : st.folderId ? { folderId: st.folderId } : { listId: st.listId };
    const siblings = await this.prisma.workStatus.findMany({ where: { ...owner, NOT: { id: statusId } }, orderBy: { order: 'asc' } });
    if (!siblings.length) throw new BadRequestException('A space needs at least one status.');
    const fallback = siblings.find((s) => s.category === 'NOT_STARTED') ?? siblings[0]!;
    await this.prisma.$transaction([
      this.prisma.workTask.updateMany({ where: { statusId }, data: { statusId: fallback.id } }),
      this.prisma.workStatus.delete({ where: { id: statusId } }),
    ]);
    return { deleted: true, movedTo: fallback.id };
  }

  /* ─────────────────────────── folders ─────────────────────────── */

  async createFolder(spaceId: number, userId: number, dto: CreateFolderDto) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    const last = await this.prisma.workFolder.findFirst({ where: { spaceId }, orderBy: { order: 'desc' }, select: { order: true } });
    return this.prisma.workFolder.create({
      data: { uid: uid(), spaceId, name: dto.name.trim(), order: (last?.order ?? 0) + 1000, createdById: userId },
    });
  }

  async updateFolder(folderId: number, userId: number, dto: UpdateFolderDto) {
    await this.access.requireFolder(folderId, userId, 'manage');
    return this.prisma.workFolder.update({
      where: { id: folderId },
      data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.order !== undefined && { order: dto.order }) },
    });
  }

  async archiveFolder(folderId: number, userId: number) {
    await this.access.requireFolder(folderId, userId, 'manage');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.workList.updateMany({ where: { folderId, archivedAt: null }, data: { archivedAt: now } }),
      this.prisma.workFolder.update({ where: { id: folderId }, data: { archivedAt: now } }),
    ]);
    return { archived: true };
  }

  /* ──────────────────────────── lists ──────────────────────────── */

  async createList(spaceId: number, userId: number, dto: CreateListDto) {
    await this.access.requireSpace(spaceId, userId, 'manage');
    if (dto.folderId) {
      const f = await this.prisma.workFolder.findFirst({ where: { id: dto.folderId, spaceId, archivedAt: null }, select: { id: true } });
      if (!f) throw new BadRequestException('Folder does not belong to this space.');
    }
    const last = await this.prisma.workList.findFirst({
      where: { spaceId, folderId: dto.folderId ?? null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.workList.create({
      data: {
        uid: uid(),
        spaceId,
        folderId: dto.folderId ?? null,
        name: dto.name.trim(),
        color: dto.color,
        description: dto.description,
        order: (last?.order ?? 0) + 1000,
        createdById: userId,
      },
    });
  }

  async updateList(listId: number, userId: number, dto: UpdateListDto) {
    const { list } = await this.access.requireList(listId, userId, 'manage');
    if (dto.folderId) {
      const f = await this.prisma.workFolder.findFirst({
        where: { id: dto.folderId, spaceId: list.spaceId, archivedAt: null },
        select: { id: true },
      });
      if (!f) throw new BadRequestException('Folder does not belong to this space.');
    }
    return this.prisma.workList.update({
      where: { id: listId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.folderId !== undefined && { folderId: dto.folderId }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  async archiveList(listId: number, userId: number) {
    await this.access.requireList(listId, userId, 'manage');
    await this.prisma.workList.update({ where: { id: listId }, data: { archivedAt: new Date() } });
    return { archived: true };
  }

  async getList(listIdOrUid: string, userId: number) {
    const n = Number(listIdOrUid);
    const row = await this.prisma.workList.findFirst({
      where: { archivedAt: null, ...(Number.isInteger(n) && String(n) === listIdOrUid ? { id: n } : { uid: listIdOrUid }) },
      select: {
        id: true, uid: true, name: true, description: true, color: true, spaceId: true, folderId: true,
        space: { select: { id: true, uid: true, name: true, color: true, workspaceId: true, workspace: { select: { uid: true, name: true } } } },
        folder: { select: { id: true, uid: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('List not found.');
    const access = await this.access.requireSpace(row.spaceId, userId, 'view');
    const [statuses, members] = await Promise.all([
      this.effectiveStatuses(row),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId: row.space.workspaceId, deletedAt: null, user: { deletedAt: null } },
        select: { user: { select: USER_MINI } },
      }),
    ]);
    return {
      ...row,
      statuses,
      members: members.map((m) => m.user),
      access: { canEdit: access.canEdit, canManage: access.canManage },
    };
  }

  /* ──────────────────────────── tasks ──────────────────────────── */

  async listTasks(listId: number, userId: number) {
    await this.access.requireList(listId, userId, 'view');
    const tasks = await this.prisma.workTask.findMany({
      where: { listId, archivedAt: null },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: TASK_SELECT,
    });
    return tasks.map(shapeTask);
  }

  async createTask(listId: number, userId: number, dto: CreateTaskDto) {
    const { list, access } = await this.access.requireList(listId, userId, 'edit');
    const statuses = await this.effectiveStatuses(list);
    const status = dto.statusId
      ? statuses.find((s) => s.id === dto.statusId)
      : statuses.find((s) => s.category === 'NOT_STARTED') ?? statuses[0];
    if (dto.statusId && !status) throw new BadRequestException('Status does not belong to this list.');
    if (dto.parentId) {
      const parent = await this.prisma.workTask.findFirst({ where: { id: dto.parentId, listId, archivedAt: null }, select: { id: true } });
      if (!parent) throw new BadRequestException('Parent task must be in the same list.');
    }
    await this.assertAssignable(access.workspaceId, dto.assigneeIds);
    const tagIds = [...new Set(dto.tagIds ?? [])];
    if (tagIds.length) {
      const n = await this.prisma.workTag.count({ where: { id: { in: tagIds }, spaceId: list.spaceId } });
      if (n !== tagIds.length) throw new BadRequestException('Tags must belong to this space.');
    }
    const last = await this.prisma.workTask.findFirst({
      where: { listId, parentId: dto.parentId ?? null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const created = await this.prisma.workTask.create({
      data: {
        uid: uid(),
        listId,
        statusId: status?.id ?? null,
        parentId: dto.parentId ?? null,
        name: dto.name.trim(),
        description: dto.description,
        priority: dto.priority,
        startDate: toDate(dto.startDate),
        dueDate: toDate(dto.dueDate),
        order: (last?.order ?? 0) + 1000,
        completedAt: status?.category === 'DONE' ? new Date() : null,
        createdById: userId,
        ...(dto.assigneeIds?.length
          ? { assignees: { create: [...new Set(dto.assigneeIds)].map((u) => ({ userId: u })) } }
          : {}),
        ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      },
      select: TASK_SELECT,
    });
    await this.detail.log(created.id, userId, 'created');
    return shapeTask(created);
  }

  async getTask(taskIdOrUid: string, userId: number) {
    const n = Number(taskIdOrUid);
    const row = await this.prisma.workTask.findFirst({
      where: { archivedAt: null, ...(Number.isInteger(n) && String(n) === taskIdOrUid ? { id: n } : { uid: taskIdOrUid }) },
      select: {
        ...TASK_SELECT,
        description: true,
        createdBy: { select: USER_MINI },
        parent: { select: { id: true, uid: true, name: true } },
        list: { select: { id: true, uid: true, name: true, spaceId: true, folderId: true, space: { select: { name: true, uid: true } } } },
        subtasks: { where: { archivedAt: null }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: TASK_SELECT },
        checklists: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          select: {
            id: true, name: true, order: true,
            items: { orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, name: true, done: true, order: true, assignee: { select: USER_MINI } } },
          },
        },
        dependsOn: { select: { id: true, type: true, to: { select: LINKED_TASK } } },
        dependedBy: { select: { id: true, type: true, from: { select: LINKED_TASK } } },
      },
    });
    if (!row) throw new NotFoundException('Task not found.');
    const access = await this.access.requireSpace(row.list.spaceId, userId, 'view');
    const statuses = await this.effectiveStatuses(row.list);
    const { subtasks, checklists, dependsOn, dependedBy, ...rest } = row as any;
    const visible = (t: any) => !t.archivedAt;
    const links = {
      waitingOn: dependsOn.filter((l: any) => l.type === 'WAITING_ON' && visible(l.to)).map((l: any) => ({ linkId: l.id, task: l.to })),
      blocking: dependedBy.filter((l: any) => l.type === 'WAITING_ON' && visible(l.from)).map((l: any) => ({ linkId: l.id, task: l.from })),
      linked: [
        ...dependsOn.filter((l: any) => l.type === 'LINKED' && visible(l.to)).map((l: any) => ({ linkId: l.id, task: l.to })),
        ...dependedBy.filter((l: any) => l.type === 'LINKED' && visible(l.from)).map((l: any) => ({ linkId: l.id, task: l.from })),
      ],
    };
    const time = await this.detail.listTime(row.id, userId);
    const running = time.entries.find((e: any) => e.running && e.user.id === userId) ?? null;
    return {
      ...shapeTask(rest),
      checklists,
      links,
      time: { totalSeconds: time.totalSeconds, myRunning: running ? { id: running.id, startedAt: running.startedAt } : null },
      description: row.description,
      createdBy: row.createdBy,
      parent: row.parent,
      list: row.list,
      subtasks: subtasks.map(shapeTask),
      statuses,
      access: { canEdit: access.canEdit, canManage: access.canManage },
    };
  }

  async updateTask(taskId: number, userId: number, dto: UpdateTaskDto) {
    const { task, access } = await this.access.requireTask(taskId, userId, 'edit');
    let listId = task.listId;
    let statusId: number | null | undefined = dto.statusId;

    // moving to another list: must be editable and in the same workspace;
    // keep the status group (category) when remapping.
    if (dto.listId !== undefined && dto.listId !== task.listId) {
      const target = await this.access.requireList(dto.listId, userId, 'edit');
      if (target.access.workspaceId !== access.workspaceId) throw new BadRequestException('Cannot move a task to another workspace.');
      listId = dto.listId;
      const targetStatuses = await this.effectiveStatuses(target.list);
      if (statusId === undefined) {
        const cur = task.statusId ? await this.prisma.workStatus.findUnique({ where: { id: task.statusId }, select: { category: true } }) : null;
        statusId = (targetStatuses.find((s) => s.category === cur?.category) ?? targetStatuses[0])?.id ?? null;
      }
    }

    let completedAt: Date | null | undefined;
    if (statusId !== undefined && statusId !== null) {
      const statuses = await this.effectiveStatuses(
        listId === task.listId
          ? { id: task.listId, folderId: task.list.folderId, spaceId: task.list.spaceId }
          : (await this.access.requireList(listId, userId, 'edit')).list,
      );
      const st = statuses.find((s) => s.id === statusId);
      if (!st) throw new BadRequestException('Status does not belong to this list.');
      completedAt = st.category === 'DONE' ? new Date() : null;
    } else if (statusId === null) {
      completedAt = null;
    }

    await this.assertAssignable(access.workspaceId, dto.assigneeIds);

    // snapshot for the activity history
    const before = await this.prisma.workTask.findUnique({
      where: { id: taskId },
      select: {
        name: true, priority: true, startDate: true, dueDate: true, timeEstimate: true, statusId: true, listId: true,
        status: { select: { name: true } },
        list: { select: { name: true, spaceId: true } },
        assignees: { select: { userId: true } },
        tags: { select: { tagId: true } },
      },
    });

    // tags must belong to the (target) list's space; moving to another space drops foreign tags
    const targetSpaceId = listId === task.listId
      ? task.list.spaceId
      : (await this.prisma.workList.findUnique({ where: { id: listId }, select: { spaceId: true } }))!.spaceId;
    if (dto.tagIds?.length) {
      const ids = [...new Set(dto.tagIds)];
      const n = await this.prisma.workTag.count({ where: { id: { in: ids }, spaceId: targetSpaceId } });
      if (n !== ids.length) throw new BadRequestException('Tags must belong to this space.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.tagIds) {
        const ids = [...new Set(dto.tagIds)];
        await tx.workTaskTag.deleteMany({ where: { taskId, tagId: { notIn: ids } } });
        await tx.workTaskTag.createMany({ data: ids.map((tagId) => ({ taskId, tagId })), skipDuplicates: true });
      } else if (targetSpaceId !== task.list.spaceId) {
        await tx.workTaskTag.deleteMany({ where: { taskId, tag: { spaceId: { not: targetSpaceId } } } });
      }
      if (dto.assigneeIds) {
        const ids = [...new Set(dto.assigneeIds)];
        await tx.workTaskAssignee.deleteMany({ where: { taskId, userId: { notIn: ids } } });
        await tx.workTaskAssignee.createMany({ data: ids.map((u) => ({ taskId, userId: u })), skipDuplicates: true });
      }
      if (listId !== task.listId) {
        // subtasks follow their parent
        await tx.workTask.updateMany({ where: { parentId: taskId }, data: { listId } });
      }
      return tx.workTask.update({
        where: { id: taskId },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.startDate !== undefined && { startDate: toDate(dto.startDate) }),
          ...(dto.dueDate !== undefined && { dueDate: toDate(dto.dueDate) }),
          ...(dto.order !== undefined && { order: dto.order }),
          ...(dto.timeEstimate !== undefined && { timeEstimate: dto.timeEstimate }),
          ...(listId !== task.listId && { listId, parentId: null }),
          ...(statusId !== undefined && { statusId }),
          // completedAt only changes when the status group actually changes
          ...(completedAt !== undefined &&
            (completedAt === null ? { completedAt: null } : task.statusId !== statusId ? { completedAt } : {})),
        },
        select: TASK_SELECT,
      });
    });
    await this.logChanges(taskId, userId, before, updated, dto);
    return shapeTask(updated);
  }

  /** Write one history row per changed field. */
  private async logChanges(taskId: number, userId: number, before: any, after: any, dto: UpdateTaskDto) {
    if (!before) return;
    const day = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    const rows: [string, unknown, unknown][] = [];
    if (dto.name !== undefined && before.name !== after.name) rows.push(['name', before.name, after.name]);
    if (after.statusId !== before.statusId) {
      const st = after.statusId ? await this.prisma.workStatus.findUnique({ where: { id: after.statusId }, select: { name: true } }) : null;
      rows.push(['status', before.status?.name ?? null, st?.name ?? null]);
    }
    if (dto.priority !== undefined && before.priority !== after.priority) rows.push(['priority', before.priority, after.priority]);
    if (dto.startDate !== undefined && day(before.startDate) !== day(after.startDate)) rows.push(['start_date', day(before.startDate), day(after.startDate)]);
    if (dto.dueDate !== undefined && day(before.dueDate) !== day(after.dueDate)) rows.push(['due_date', day(before.dueDate), day(after.dueDate)]);
    if (dto.timeEstimate !== undefined && before.timeEstimate !== after.timeEstimate) rows.push(['estimate', before.timeEstimate, after.timeEstimate]);
    if (dto.assigneeIds) {
      const b = before.assignees.map((a: any) => a.userId).sort();
      const a = after.assignees.map((x: any) => x.user.id).sort();
      if (b.join() !== a.join()) rows.push(['assignees', b, a]);
    }
    if (dto.tagIds) {
      const b = before.tags.map((t: any) => t.tagId).sort();
      const a = after.tags.map((t: any) => t.tag.id).sort();
      if (b.join() !== a.join()) rows.push(['tags', b, after.tags.map((t: any) => t.tag.name)]);
    }
    if (after.listId !== before.listId) {
      const l = await this.prisma.workList.findUnique({ where: { id: after.listId }, select: { name: true } });
      rows.push(['moved', before.list?.name ?? null, l?.name ?? null]);
    }
    for (const [action, from, to] of rows) await this.detail.log(taskId, userId, action, from, to);
  }

  async archiveTask(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'edit');
    await this.detail.log(taskId, userId, 'archived');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.workTask.updateMany({ where: { parentId: taskId, archivedAt: null }, data: { archivedAt: now } }),
      this.prisma.workTask.update({ where: { id: taskId }, data: { archivedAt: now } }),
    ]);
    return { archived: true };
  }

  /* ────────────────────────── comments ─────────────────────────── */

  async listComments(taskId: number, userId: number) {
    await this.access.requireTask(taskId, userId, 'view');
    return this.prisma.workComment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: COMMENT_SELECT,
    });
  }

  async createComment(taskId: number, userId: number, dto: CreateCommentDto) {
    await this.access.requireTask(taskId, userId, 'edit');
    if (dto.parentId) {
      const p = await this.prisma.workComment.findFirst({ where: { id: dto.parentId, taskId, deletedAt: null }, select: { id: true } });
      if (!p) throw new BadRequestException('Reply target is not on this task.');
    }
    if (dto.assigneeId) {
      const { access } = await this.access.requireTask(taskId, userId, 'edit');
      const ok = await this.prisma.workspaceMember.count({ where: { workspaceId: access.workspaceId, userId: dto.assigneeId, deletedAt: null } });
      if (!ok) throw new BadRequestException('Comments can only be assigned to workspace members.');
    }
    return this.prisma.workComment.create({
      data: { taskId, userId, parentId: dto.parentId ?? null, content: dto.content, assigneeId: dto.assigneeId ?? null },
      select: COMMENT_SELECT,
    });
  }

  private async ownComment(commentId: number, userId: number) {
    const c = await this.prisma.workComment.findFirst({ where: { id: commentId, deletedAt: null }, select: { id: true, taskId: true, userId: true } });
    if (!c) throw new NotFoundException('Comment not found.');
    await this.access.requireTask(c.taskId, userId, 'view');
    if (c.userId !== userId) throw new ForbiddenException('You can only change your own comments.');
    return c;
  }

  async updateComment(commentId: number, userId: number, dto: UpdateCommentDto) {
    await this.ownComment(commentId, userId);
    return this.prisma.workComment.update({
      where: { id: commentId },
      data: { content: dto.content },
      select: COMMENT_SELECT,
    });
  }

  async deleteComment(commentId: number, userId: number) {
    await this.ownComment(commentId, userId);
    await this.prisma.workComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  /* ─────────────────────────── my work ─────────────────────────── */

  async myTasks(workspaceId: number, userId: number) {
    const ws = await this.access.requireWorkspace(workspaceId, userId, 'view');
    const rows = await this.prisma.workTask.findMany({
      where: {
        archivedAt: null,
        assignees: { some: { userId } },
        list: {
          archivedAt: null,
          space: {
            workspaceId,
            archivedAt: null,
            ...(ws.canManage ? {} : { OR: [{ isPrivate: false }, { members: { some: { userId } } }] }),
          },
        },
      },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      take: 500,
      select: {
        ...TASK_SELECT,
        status: { select: { id: true, name: true, color: true, category: true } },
        list: { select: { id: true, uid: true, name: true, space: { select: { name: true, color: true } } } },
      },
    });
    return rows.map((r: any) => ({ ...shapeTask(r), status: r.status, list: r.list }));
  }
}
