import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { WorkAccessService } from './work-access.service';

const uid = () => randomBytes(9).toString('base64url');
export type ViewLocation = 'list' | 'folder' | 'space';
const LIST_KINDS = ['list', 'board', 'calendar', 'table', 'gallery', 'gantt', 'timeline', 'workload', 'activity', 'mindmap', 'team', 'map', 'collection', 'dashboard', 'embed', 'doc', 'form'];
/** what a space / folder can show (it spans several lists) */
const LOCATION_KINDS = ['list', 'board', 'calendar', 'team', 'dashboard', 'embed', 'doc'];
const DEFAULTS: Record<ViewLocation, { kind: string; name: string }[]> = {
  list: [{ kind: 'list', name: 'List' }, { kind: 'board', name: 'Board' }, { kind: 'calendar', name: 'Calendar' }],
  folder: [{ kind: 'list', name: 'List' }, { kind: 'board', name: 'Board' }, { kind: 'calendar', name: 'Calendar' }, { kind: 'team', name: 'Team' }, { kind: 'dashboard', name: 'Dashboard' }],
  space: [{ kind: 'list', name: 'List' }, { kind: 'board', name: 'Board' }, { kind: 'calendar', name: 'Calendar' }, { kind: 'team', name: 'Team' }, { kind: 'dashboard', name: 'Dashboard' }],
};
const SELECT = { uid: true, kind: true, name: true, position: true, settings: true, createdById: true, updatedAt: true } as const;

/**
 * Saved views of a list / folder / space (ClickUp style): shared with everyone who can open the
 * location, any number of them, named and ordered. Editing them needs edit access to the location.
 */
@Injectable()
export class WorkViewsService {
  constructor(private readonly prisma: PrismaService, private readonly access: WorkAccessService) {}

  /** the location by uid (or id), with this person's access */
  private async location(type: string, ref: string, userId: number, level: 'view' | 'edit') {
    const t = String(type) as ViewLocation;
    const byRef = /^\d+$/.test(String(ref)) ? { id: Number(ref) } : { uid: String(ref ?? '') };
    if (t === 'list') {
      const l = await this.prisma.workList.findFirst({ where: { ...byRef, archivedAt: null }, select: { id: true } });
      if (!l) throw new NotFoundException('List not found.');
      const { access } = await this.access.requireList(l.id, userId, level);
      return { type: t, id: l.id, canEdit: access.canEdit };
    }
    if (t === 'folder') {
      const f = await this.prisma.workFolder.findFirst({ where: { ...byRef, archivedAt: null }, select: { id: true } });
      if (!f) throw new NotFoundException('Folder not found.');
      const { access } = await this.access.requireFolder(f.id, userId, level);
      return { type: t, id: f.id, canEdit: access.canEdit };
    }
    if (t === 'space') {
      const s = await this.prisma.space.findFirst({ where: { ...byRef, archivedAt: null }, select: { id: true } });
      if (!s) throw new NotFoundException('Space not found.');
      const access = await this.access.requireSpace(s.id, userId, level);
      return { type: t, id: s.id, canEdit: access.canEdit };
    }
    throw new BadRequestException('Unknown location.');
  }

  private async viewOf(viewUid: string, userId: number, level: 'view' | 'edit') {
    const v = await this.prisma.workView.findUnique({ where: { uid: String(viewUid ?? '') } });
    if (!v) throw new NotFoundException('View not found.');
    const loc = await this.location(v.locationType, String(v.locationId), userId, level);
    return { v, loc };
  }

  private cleanSettings(kind: string, raw: unknown): Prisma.InputJsonValue | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Bad view settings.');
    const json = JSON.stringify(raw);
    if (json.length > 20_000) throw new BadRequestException('View settings are too big.');
    const s = JSON.parse(json) as Record<string, unknown>;
    if (kind === 'embed') {
      const url = String(s.url ?? '');
      if (!/^https:\/\/[^\s]+$/.test(url)) throw new BadRequestException('An embed needs an https link.');
    }
    return s as Prisma.InputJsonValue;
  }

  /**
   * Every "dashboard" view in a workspace this person can open (the Dashboards hub), with where
   * it lives and whether they may edit that location. Outsiders get 404; guests / limited members
   * only see the spaces shared with them.
   */
  async dashboards(wsRef: string, userId: number) {
    const ref = String(wsRef ?? '');
    const ws = await this.prisma.workWorkspace.findFirst({ where: { deletedAt: null, ...(/^\d+$/.test(ref) ? { id: Number(ref) } : { uid: ref }) }, select: { id: true } });
    if (!ws) throw new NotFoundException('Workspace not found.');
    await this.access.requireWorkspace(ws.id, userId, 'view');
    const spaces = await this.prisma.space.findMany({ where: { workspaceId: ws.id, archivedAt: null }, select: { id: true, uid: true, name: true, color: true } });
    const can = new Map<number, { view: boolean; edit: boolean }>();
    for (const sp of spaces) { const a = await this.access.forSpace(sp.id, userId); can.set(sp.id, { view: a.canView, edit: a.canEdit }); }
    const open = spaces.filter((sp) => can.get(sp.id)!.view);
    const ids = open.map((sp) => sp.id);
    const [folders, lists] = await Promise.all([
      this.prisma.workFolder.findMany({ where: { spaceId: { in: ids }, archivedAt: null }, select: { id: true, uid: true, name: true, spaceId: true } }),
      this.prisma.workList.findMany({ where: { spaceId: { in: ids }, archivedAt: null, OR: [{ folderId: null }, { folder: { archivedAt: null } }] }, select: { id: true, uid: true, name: true, spaceId: true, folderId: true } }),
    ]);
    const rows = await this.prisma.workView.findMany({
      where: { kind: 'dashboard', OR: [
        { locationType: 'space', locationId: { in: ids } },
        { locationType: 'folder', locationId: { in: folders.map((f) => f.id) } },
        { locationType: 'list', locationId: { in: lists.map((l) => l.id) } },
      ] },
      orderBy: [{ updatedAt: 'desc' }],
      select: { uid: true, name: true, updatedAt: true, locationType: true, locationId: true },
    });
    const spaceOf = new Map(open.map((sp) => [sp.id, sp]));
    return rows.map((v) => {
      if (v.locationType === 'space') {
        const sp = spaceOf.get(v.locationId)!;
        return { uid: v.uid, name: v.name, updatedAt: v.updatedAt, location: { type: 'space', uid: sp.uid, name: sp.name, path: '', color: sp.color }, canEdit: can.get(sp.id)!.edit };
      }
      if (v.locationType === 'folder') {
        const f = folders.find((x) => x.id === v.locationId)!; const sp = spaceOf.get(f.spaceId)!;
        return { uid: v.uid, name: v.name, updatedAt: v.updatedAt, location: { type: 'folder', uid: f.uid, name: f.name, path: sp.name, color: sp.color }, canEdit: can.get(sp.id)!.edit };
      }
      const l = lists.find((x) => x.id === v.locationId)!; const sp = spaceOf.get(l.spaceId)!; const f = l.folderId ? folders.find((x) => x.id === l.folderId) : null;
      return { uid: v.uid, name: v.name, updatedAt: v.updatedAt, location: { type: 'list', uid: l.uid, name: l.name, path: f ? `${sp.name} / ${f.name}` : sp.name, color: sp.color }, canEdit: can.get(sp.id)!.edit };
    });
  }

  /** the views of a location; the defaults are made the first time anyone opens it */
  async list(type: string, ref: string, userId: number) {
    const loc = await this.location(type, ref, userId, 'view');
    let rows = await this.prisma.workView.findMany({ where: { locationType: loc.type, locationId: loc.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: SELECT });
    if (!rows.length) {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.workView.count({ where: { locationType: loc.type, locationId: loc.id } })) return;
        let pos = 1000;
        for (const d of DEFAULTS[loc.type]) await tx.workView.create({ data: { uid: uid(), locationType: loc.type, locationId: loc.id, kind: d.kind, name: d.name, position: (pos += 1000), createdById: userId } });
      });
      rows = await this.prisma.workView.findMany({ where: { locationType: loc.type, locationId: loc.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: SELECT });
    }
    return { canEdit: loc.canEdit, views: rows };
  }

  async create(userId: number, b: { type?: string; ref?: string; kind?: string; name?: string; settings?: unknown; after?: string }) {
    const loc = await this.location(String(b?.type), String(b?.ref), userId, 'edit');
    const kind = String(b?.kind ?? '');
    if (!(loc.type === 'list' ? LIST_KINDS : LOCATION_KINDS).includes(kind)) throw new BadRequestException('That view is not available here.');
    const name = String(b?.name ?? '').trim().slice(0, 60) || kind.charAt(0).toUpperCase() + kind.slice(1);
    const last = await this.prisma.workView.findFirst({ where: { locationType: loc.type, locationId: loc.id }, orderBy: { position: 'desc' }, select: { position: true } });
    if ((await this.prisma.workView.count({ where: { locationType: loc.type, locationId: loc.id } })) >= 50) throw new BadRequestException('Too many views here.');
    return this.prisma.workView.create({ data: { uid: uid(), locationType: loc.type, locationId: loc.id, kind, name, settings: this.cleanSettings(kind, b?.settings), position: (last?.position ?? 1000) + 1000, createdById: userId }, select: SELECT });
  }

  async update(viewUid: string, userId: number, b: { name?: string; settings?: unknown; position?: number }) {
    const { v } = await this.viewOf(viewUid, userId, 'edit');
    const data: Prisma.WorkViewUpdateInput = {};
    if (b?.name !== undefined) data.name = String(b.name).trim().slice(0, 60) || v.name;
    if (b?.settings !== undefined) data.settings = this.cleanSettings(v.kind, b.settings) ?? Prisma.DbNull;
    if (b?.position !== undefined) {
      const n = Number(b.position);
      if (!Number.isFinite(n)) throw new BadRequestException('Bad position.');
      data.position = n;
    }
    return this.prisma.workView.update({ where: { id: v.id }, data, select: SELECT });
  }

  /** move one place left / right */
  async move(viewUid: string, userId: number, dir: string) {
    const { v } = await this.viewOf(viewUid, userId, 'edit');
    const all = await this.prisma.workView.findMany({ where: { locationType: v.locationType, locationId: v.locationId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } });
    const i = all.findIndex((x) => x.id === v.id);
    const j = dir === 'left' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return { ok: true };
    [all[i], all[j]] = [all[j]!, all[i]!];
    await this.prisma.$transaction(all.map((x, k) => this.prisma.workView.update({ where: { id: x.id }, data: { position: (k + 1) * 1000 } })));
    return { ok: true };
  }

  async duplicate(viewUid: string, userId: number) {
    const { v } = await this.viewOf(viewUid, userId, 'edit');
    const next = await this.prisma.workView.findFirst({ where: { locationType: v.locationType, locationId: v.locationId, position: { gt: v.position } }, orderBy: { position: 'asc' }, select: { position: true } });
    return this.prisma.workView.create({
      data: { uid: uid(), locationType: v.locationType, locationId: v.locationId, kind: v.kind, name: `${v.name} copy`.slice(0, 60), settings: (v.settings ?? undefined) as Prisma.InputJsonValue | undefined, position: next ? (v.position + next.position) / 2 : v.position + 1000, createdById: userId },
      select: SELECT,
    });
  }

  async remove(viewUid: string, userId: number) {
    const { v } = await this.viewOf(viewUid, userId, 'edit');
    if ((await this.prisma.workView.count({ where: { locationType: v.locationType, locationId: v.locationId } })) <= 1) throw new BadRequestException('Keep at least one view.');
    await this.prisma.workView.delete({ where: { id: v.id } });
    return { ok: true };
  }
}
