import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Who can do what in Work (ClickUp-style product).
 *
 *  - workspace OWNER / ADMIN, super admin  → manage: spaces, folders, lists, statuses
 *  - workspace MEMBER                      → edit:   tasks, assignees, comments
 *  - workspace VIEWER / GUEST              → view only
 *  - private space: visible only to its SpaceMember rows + OWNER/ADMIN/super admin
 */
export type WorkLevel = 'view' | 'edit' | 'manage';

export interface WorkAccess {
  workspaceId: number;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
}

@Injectable()
export class WorkAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Access to a workspace's Work area (ignores private spaces). */
  async forWorkspace(workspaceId: number, userId: number): Promise<WorkAccess> {
    const [user, member] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { systemRole: true } }),
      this.prisma.workspaceMember.findFirst({
        where: { workspaceId, userId, deletedAt: null },
        select: { role: true },
      }),
    ]);
    const superAdmin = user?.systemRole === 'SUPER_ADMIN';
    const role = member?.role;
    const canManage = superAdmin || role === 'OWNER' || role === 'ADMIN';
    const canEdit = canManage || role === 'MEMBER';
    const canView = canEdit || role === 'VIEWER' || role === 'GUEST';
    return { workspaceId, canView, canEdit, canManage };
  }

  /** Access to one space, honouring private spaces. */
  async forSpace(spaceId: number, userId: number): Promise<WorkAccess & { spaceId: number }> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, archivedAt: null },
      select: { id: true, workspaceId: true, isPrivate: true },
    });
    if (!space) throw new NotFoundException('Space not found.');
    const ws = await this.forWorkspace(space.workspaceId, userId);
    if (space.isPrivate && !ws.canManage) {
      const inSpace = await this.prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: { userId: true },
      });
      if (!inSpace) return { ...ws, spaceId, canView: false, canEdit: false, canManage: false };
    }
    return { ...ws, spaceId };
  }

  /** Throws 404 when the user can't even see it (don't leak existence), 403 when they can see but not act. */
  assert(access: WorkAccess, level: WorkLevel) {
    if (!access.canView) throw new NotFoundException('Not found.');
    if (level === 'edit' && !access.canEdit) throw new ForbiddenException('You do not have permission to edit here.');
    if (level === 'manage' && !access.canManage) {
      throw new ForbiddenException('Only workspace owners and admins can do this.');
    }
  }

  async requireWorkspace(workspaceId: number, userId: number, level: WorkLevel) {
    const a = await this.forWorkspace(workspaceId, userId);
    this.assert(a, level);
    return a;
  }

  async requireSpace(spaceId: number, userId: number, level: WorkLevel) {
    const a = await this.forSpace(spaceId, userId);
    this.assert(a, level);
    return a;
  }

  async requireFolder(folderId: number, userId: number, level: WorkLevel) {
    const f = await this.prisma.workFolder.findFirst({ where: { id: folderId, archivedAt: null }, select: { id: true, spaceId: true } });
    if (!f) throw new NotFoundException('Folder not found.');
    return { folder: f, access: await this.requireSpace(f.spaceId, userId, level) };
  }

  async requireList(listId: number, userId: number, level: WorkLevel) {
    const l = await this.prisma.workList.findFirst({
      where: { id: listId, archivedAt: null },
      select: { id: true, spaceId: true, folderId: true },
    });
    if (!l) throw new NotFoundException('List not found.');
    return { list: l, access: await this.requireSpace(l.spaceId, userId, level) };
  }

  async requireTask(taskId: number, userId: number, level: WorkLevel) {
    const t = await this.prisma.workTask.findFirst({
      where: { id: taskId, archivedAt: null },
      select: { id: true, listId: true, statusId: true, list: { select: { spaceId: true, folderId: true } } },
    });
    if (!t) throw new NotFoundException('Task not found.');
    return { task: t, access: await this.requireSpace(t.list.spaceId, userId, level) };
  }
}
