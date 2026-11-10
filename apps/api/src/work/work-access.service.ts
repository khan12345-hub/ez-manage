import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Who can do what in Work (ClickUp-style product). Work access is its OWN
 * membership (WorkMember) — Boards workspace roles grant nothing here.
 *
 *  - super admin, Work OWNER / ADMIN  → manage: spaces, folders, lists, statuses, people
 *  - Work MEMBER                      → edit, every public space (+ private ones they're in)
 *  - Work LIMITED_MEMBER              → edit, only spaces shared with them (SpaceMember)
 *  - Work GUEST                       → view only, only spaces shared with them
 *  - no WorkMember row                → nothing (404)
 *  The workspace's Boards OWNER is bootstrapped as Work OWNER so someone can invite people.
 */
export type WorkLevel = 'view' | 'comment' | 'edit' | 'manage';
export type WorkRoleName = 'OWNER' | 'ADMIN' | 'MEMBER' | 'LIMITED_MEMBER' | 'GUEST';

export interface WorkAccess {
  workspaceId: number;
  role: WorkRoleName | null;
  /** all = every public space; shared = only spaces they were added to */
  scope: 'all' | 'shared';
  canView: boolean;
  /** comment (and react) without editing: "Comment" space permission */
  canComment: boolean;
  canEdit: boolean;
  canManage: boolean;
}

@Injectable()
export class WorkAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The user's role in a Work workspace — only from Work membership (Boards plays no part). */
  async roleIn(workspaceId: number, userId: number): Promise<{ role: WorkRoleName | null; superAdmin: boolean }> {
    const [user, member, ws] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { systemRole: true } }),
      this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true } }),
      this.prisma.workWorkspace.findFirst({ where: { id: workspaceId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!user || !ws) return { role: null, superAdmin: false };
    // the platform/Boards system role grants nothing in Work — only Work membership counts
    return { role: (member?.role as WorkRoleName) ?? null, superAdmin: false };
  }

  /** Access to a workspace's Work area (ignores private spaces). */
  async forWorkspace(workspaceId: number, userId: number): Promise<WorkAccess> {
    const { role, superAdmin } = await this.roleIn(workspaceId, userId);
    const canManage = superAdmin || role === 'OWNER' || role === 'ADMIN';
    const canEdit = canManage || role === 'MEMBER' || role === 'LIMITED_MEMBER';
    const canView = canEdit || role === 'GUEST';
    const scope = !canManage && (role === 'LIMITED_MEMBER' || role === 'GUEST') ? 'shared' : 'all';
    return { workspaceId, role, scope, canView, canComment: canEdit, canEdit, canManage };
  }

  /** Prisma filter for the spaces this user may see in a workspace. */
  visibleSpaces(ws: WorkAccess, userId: number) {
    if (ws.canManage) return {};
    if (ws.scope === 'shared') return { members: { some: { userId } } };
    return { OR: [{ isPrivate: false }, { members: { some: { userId } } }] };
  }

  /** Are all these users Work members of the workspace? (assignees, mentions, checklist owners) */
  async areMembers(workspaceId: number, userIds: number[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return true;
    const n = await this.prisma.workMember.count({ where: { workspaceId, userId: { in: ids }, user: { deletedAt: null } } });
    return n === ids.length;
  }

  /** Access to one space, honouring private spaces. */
  async forSpace(spaceId: number, userId: number): Promise<WorkAccess & { spaceId: number }> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, archivedAt: null },
      select: { id: true, workspaceId: true, isPrivate: true, defaultPermission: true },
    });
    if (!space) throw new NotFoundException('Space not found.');
    const ws = await this.forWorkspace(space.workspaceId, userId);
    if (ws.canView && !ws.canManage && (space.isPrivate || ws.scope === 'shared')) {
      const inSpace = await this.prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
        select: { userId: true },
      });
      if (!inSpace) return { ...ws, spaceId, canView: false, canComment: false, canEdit: false, canManage: false };
    }
    // the space's default permission narrows what members can do (owners/admins keep everything)
    if (!ws.canManage && ws.canEdit) {
      if (space.defaultPermission === 'view') return { ...ws, spaceId, canComment: false, canEdit: false };
      if (space.defaultPermission === 'comment') return { ...ws, spaceId, canComment: true, canEdit: false };
    }
    return { ...ws, spaceId };
  }

  /** Throws 404 when the user can't even see it (don't leak existence), 403 when they can see but not act. */
  assert(access: WorkAccess, level: WorkLevel) {
    if (!access.canView) throw new NotFoundException('Not found.');
    if (level === 'comment' && !access.canComment) throw new ForbiddenException('You can only view this space.');
    if (level === 'edit' && !access.canEdit) throw new ForbiddenException('You do not have permission to edit here.');
    if (level === 'manage' && !access.canManage) {
      throw new ForbiddenException('Only Work owners and admins can do this.');
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
