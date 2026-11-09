import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const byUid = (idOrUid: string) => {
  const n = Number(idOrUid);
  return Number.isInteger(n) && String(n) === idOrUid ? { id: n } : { uid: idOrUid };
};

/**
 * Space / Folder overview (what ClickUp shows when you click a space or a
 * folder in the sidebar): every list with open / done / overdue counts.
 */
@Injectable()
export class WorkOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkAccessService,
  ) {}

  async space(idOrUid: string, userId: number) {
    const space = await this.prisma.space.findFirst({
      where: { ...byUid(idOrUid), archivedAt: null },
      select: { id: true, uid: true, name: true, color: true, isPrivate: true, workspace: { select: { uid: true, name: true } } },
    });
    if (!space) throw new NotFoundException('Space not found.');
    const access = await this.access.requireSpace(space.id, userId, 'view');
    const lists = await this.prisma.workList.findMany({
      where: { spaceId: space.id, archivedAt: null, OR: [{ folderId: null }, { folder: { archivedAt: null } }] },
      orderBy: [{ folderId: 'asc' }, { order: 'asc' }],
      select: { id: true, uid: true, name: true, color: true, folder: { select: { id: true, uid: true, name: true } } },
    });
    const folders = await this.prisma.workFolder.findMany({ where: { spaceId: space.id, archivedAt: null }, orderBy: { order: 'asc' }, select: { id: true, uid: true, name: true } });
    return { kind: 'space' as const, space, folder: null, folders, lists: await this.withCounts(lists), access: { canEdit: access.canEdit, canManage: access.canManage } };
  }

  async folder(idOrUid: string, userId: number) {
    const folder = await this.prisma.workFolder.findFirst({
      where: { ...byUid(idOrUid), archivedAt: null },
      select: { id: true, uid: true, name: true, space: { select: { id: true, uid: true, name: true, color: true, isPrivate: true, workspace: { select: { uid: true, name: true } } } } },
    });
    if (!folder) throw new NotFoundException('Folder not found.');
    const access = await this.access.requireSpace(folder.space.id, userId, 'view');
    const lists = await this.prisma.workList.findMany({
      where: { folderId: folder.id, archivedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, uid: true, name: true, color: true, folder: { select: { id: true, uid: true, name: true } } },
    });
    return {
      kind: 'folder' as const,
      space: folder.space,
      folder: { id: folder.id, uid: folder.uid, name: folder.name },
      folders: [],
      lists: await this.withCounts(lists),
      access: { canEdit: access.canEdit, canManage: access.canManage },
    };
  }

  private async withCounts<T extends { id: number }>(lists: T[]) {
    if (!lists.length) return [];
    const ids = lists.map((l) => l.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [total, done, overdue] = await Promise.all([
      this.prisma.workTask.groupBy({ by: ['listId'], where: { listId: { in: ids }, archivedAt: null, parentId: null }, _count: { _all: true } }),
      this.prisma.workTask.groupBy({ by: ['listId'], where: { listId: { in: ids }, archivedAt: null, parentId: null, completedAt: { not: null } }, _count: { _all: true } }),
      this.prisma.workTask.groupBy({ by: ['listId'], where: { listId: { in: ids }, archivedAt: null, parentId: null, completedAt: null, dueDate: { lt: today } }, _count: { _all: true } }),
    ]);
    const n = (rows: { listId: number; _count: { _all: number } }[], id: number) => rows.find((r) => r.listId === id)?._count._all ?? 0;
    return lists.map((l) => {
      const t = n(total, l.id);
      const d = n(done, l.id);
      return { ...l, total: t, done: d, open: t - d, overdue: n(overdue, l.id) };
    });
  }
}
