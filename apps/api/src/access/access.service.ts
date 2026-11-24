import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { randomBytes } from 'crypto';
import { Prisma, WorkspaceMemberRole } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { InvitationsService } from 'src/invitations/invitations.service';
import { MailService } from 'src/mail/mail.service';
import { WorkspaceService } from 'src/workspace/workspace.service';
import { WorkPeopleService } from 'src/work/work-people.service';
import type { WorkRoleName } from 'src/work/work-access.service';
import { AccessAuditService } from './access-audit.service';
import { PRODUCTS, PRODUCT_LABEL, ProductAccessService, type Product } from './product-access.service';
import { ProductAdminService, ADMIN_PRODUCTS, type AdminProduct } from './product-admin.service';

const USER = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, systemRole: true, status: true, lastLoginAt: true, createdAt: true } as const;
const ACC_ROLES: WorkspaceMemberRole[] = ['ADMIN', 'MEMBER', 'VIEWER', 'GUEST'];
const WORK_ROLES: WorkRoleName[] = ['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST'];
const ADMINISH = ['OWNER', 'ADMIN'];
const TRACKED_WORK = ['OWNER', 'ADMIN', 'MEMBER', 'LIMITED_MEMBER'];
const TRACKED_ACC = ['OWNER', 'ADMIN', 'MEMBER'];
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ROLE = (r: string) => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

export type Scope = { product: 'accounts' | 'work' | 'tracker'; workspaceId: number; source: 'boards' | 'work' | null; mayGrantAdmin: boolean };
/** who is using the Access Center: a global Administrator, a per-product Administrator, or an Access Manager with scopes */
export type Actor = { id: number; admin: boolean; scopes: Scope[]; productAdminOf: AdminProduct[] };
export type UserFilter = { q?: string; product?: string; role?: string; status?: string; page?: number; pageSize?: number };
export type InviteBody = {
  emails: string[];
  accounts?: { workspaceId: number; role: string; boardIds?: number[] } | null;
  work?: { workspaceId: number; role: string } | null;
  tracker?: { source: 'boards' | 'work'; workspaceId: number; role: 'member' | 'admin' } | null;
  crm?: { workspaceId: number; role: string } | null;
  vault?: boolean;
};

/**
 * Access Center. Companies and roles stay in each product; every change goes through that
 * product's own service (with the Access Center's own scope check instead of a membership
 * check), so its rules and notifications apply. On top: the per-person product switch, system
 * roles (Administrator / Co-Administrator), Access Managers and the access history.
 * It never returns product content — only names, roles and counts.
 */
@Injectable()
export class AccessService {
  private readonly log = new Logger('AccessCenter');
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductAccessService,
    private readonly productAdmin: ProductAdminService,
    private readonly audit: AccessAuditService,
    private readonly invitations: InvitationsService,
    private readonly workspaces: WorkspaceService,
    private readonly workPeople: WorkPeopleService,
    private readonly mail: MailService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── who is asking ──

  async actor(userId: number): Promise<Actor | null> {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null, status: 'ACTIVE' }, select: { systemRole: true } });
    if (!u) return null;
    if (u.systemRole === 'SUPER_ADMIN') return { id: userId, admin: true, scopes: [], productAdminOf: [] };
    const [granted, productAdminSet] = await Promise.all([
      this.prisma.accessManagerScope.findMany({ where: { userId }, select: { product: true, workspaceId: true, source: true, mayGrantAdmin: true } }),
      this.productAdmin.products(userId),
    ]);
    const productAdminOf = ADMIN_PRODUCTS.filter((p) => productAdminSet.has(p));
    // a per-product Administrator manages every company of their product from the Access Center:
    // synthesise full scopes (accounts / work) so the existing people-management machinery applies
    const synth = await this.productAdminScopes(productAdminOf);
    // de-dupe synthesised scopes against explicit manager scopes
    const seen = new Set((granted as Scope[]).map((s) => `${s.product}:${s.workspaceId}:${s.source ?? ''}`));
    const scopes = [...(granted as Scope[]), ...synth.filter((s) => !seen.has(`${s.product}:${s.workspaceId}:${s.source ?? ''}`))];
    if (!scopes.length && !productAdminOf.length) return null;
    return { id: userId, admin: false, scopes, productAdminOf };
  }

  /** every company of each accounts/work product the person administers, as full scopes */
  private async productAdminScopes(productAdminOf: AdminProduct[]): Promise<Scope[]> {
    const out: Scope[] = [];
    if (productAdminOf.includes('accounts')) {
      const ws = await this.prisma.workspace.findMany({ select: { id: true } });
      for (const w of ws) out.push({ product: 'accounts', workspaceId: w.id, source: null, mayGrantAdmin: true });
    }
    if (productAdminOf.includes('work')) {
      const ws = await this.prisma.workWorkspace.findMany({ where: { deletedAt: null }, select: { id: true } });
      for (const w of ws) out.push({ product: 'work', workspaceId: w.id, source: null, mayGrantAdmin: true });
    }
    return out;
  }

  private scopeFor(a: Actor, product: 'accounts' | 'work' | 'tracker', workspaceId: number, source?: 'boards' | 'work') {
    if (a.admin) return { mayGrantAdmin: true };
    return a.scopes.find((s) => s.product === product && s.workspaceId === workspaceId && (product !== 'tracker' || s.source === source)) ?? null;
  }
  /** inside the actor's companies, and Owner/Admin only with "may grant admin" */
  private need(a: Actor, product: 'accounts' | 'work' | 'tracker', workspaceId: number, role?: string | null, source?: 'boards' | 'work') {
    const s = this.scopeFor(a, product, workspaceId, source);
    if (!s) throw new ForbiddenException('That company is outside the companies you manage.');
    if (role && ADMINISH.includes(String(role).toUpperCase()) && !s.mayGrantAdmin) throw new ForbiddenException('You can give Member roles only. Ask the Administrator to let you grant Admin.');
  }
  private needAdmin(a: Actor) {
    if (!a.admin) throw new ForbiddenException('Only the Administrator can do this.');
  }
  private accWs(a: Actor) { return [...new Set(a.scopes.filter((s) => s.product === 'accounts' || (s.product === 'tracker' && s.source === 'boards')).map((s) => s.workspaceId))]; }
  private workWs(a: Actor) { return [...new Set(a.scopes.filter((s) => s.product === 'work' || (s.product === 'tracker' && s.source === 'work')).map((s) => s.workspaceId))]; }
  /** an Access Manager only sees people in their companies */
  private visible(a: Actor): Prisma.UserWhereInput | null {
    if (a.admin) return null;
    return { OR: [{ workspaceMemberships: { some: { deletedAt: null, workspaceId: { in: this.accWs(a) } } } }, { workMemberships: { some: { workspaceId: { in: this.workWs(a) } } } }] };
  }

  async me(userId: number) {
    const a = await this.actor(userId);
    if (!a) return { canManage: false, admin: false, scopes: [] as Scope[], productAdminOf: [] as AdminProduct[] };
    return { canManage: true, admin: a.admin, scopes: a.scopes, productAdminOf: a.productAdminOf };
  }

  // ── per-product Administrators (global Administrator only) ──

  async setProductAdmin(a: Actor, userId: number, product: string, on: boolean) {
    this.needAdmin(a);
    if (!ADMIN_PRODUCTS.includes(product as AdminProduct)) throw new BadRequestException('Unknown product.');
    const u = await this.target(userId);
    if (u.systemRole === 'SUPER_ADMIN') throw new BadRequestException('Administrators already manage every product.');
    const was = await this.productAdmin.is(userId, product as AdminProduct);
    if (was === on) return this.user(a, userId);
    await this.productAdmin.set(userId, product as AdminProduct, on, a.id);
    // their sign-in carries their reach: end it so the change applies at once
    await this.prisma.$executeRaw`DELETE FROM sessions WHERE (sess::jsonb -> 'user' ->> 'id') = ${String(userId)}`;
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'system', action: on ? 'product_admin_set' : 'product_admin_removed', toRole: PRODUCT_LABEL[product as Product] ?? product, via: 'access_center' });
    return this.user(a, userId);
  }

  // ── reading ──

  private async trackerAdminOf(userIds: number[]) {
    const out = new Map<number, number>();
    if (!userIds.length) return out;
    try {
      const rows = await this.prisma.$queryRaw<{ userId: number; n: bigint }[]>`SELECT "userId", count(*) AS n FROM tracker_members WHERE role = 'admin' AND "userId" IN (${Prisma.join(userIds)}) GROUP BY "userId"`;
      for (const r of rows) out.set(r.userId, Number(r.n));
    } catch {
      try {
        const rows = await this.prisma.$queryRaw<{ userId: number; n: bigint }[]>`SELECT "userId", count(*) AS n FROM tracker_admins WHERE "userId" IN (${Prisma.join(userIds)}) GROUP BY "userId"`;
        for (const r of rows) out.set(r.userId, Number(r.n));
      } catch { /* EZ Tracker tables not there yet */ }
    }
    return out;
  }
  private async trackerDevices(userIds: number[]) {
    const out = new Map<number, number>();
    if (!userIds.length) return out;
    try {
      const rows = await this.prisma.trackerDevice.groupBy({ by: ['userId'], where: { userId: { in: userIds }, revokedAt: null }, _count: { _all: true } });
      for (const r of rows) out.set(r.userId, r._count._all);
    } catch { /* not there yet */ }
    return out;
  }

  async users(a: Actor, f: UserFilter) {
    const page = Math.max(1, f.page ?? 1), take = Math.min(100, Math.max(5, f.pageSize ?? 25));
    const q = f.q?.trim();
    const role = f.role?.toUpperCase();
    const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];
    const vis = this.visible(a);
    if (vis) and.push(vis);
    if (q) and.push({ OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] });
    if (f.status === 'disabled') and.push({ status: { not: 'ACTIVE' } });
    else if (f.status === 'active') and.push({ status: 'ACTIVE' });
    const accIn = a.admin ? {} : { workspaceId: { in: this.accWs(a) } };
    const workIn = a.admin ? {} : { workspaceId: { in: this.workWs(a) } };
    const accWhere: Prisma.WorkspaceMemberWhereInput = { deletedAt: null, ...accIn, ...(role ? { role: role as WorkspaceMemberRole } : {}) };
    const workWhere: Prisma.WorkMemberWhereInput = { workspace: { deletedAt: null }, ...workIn, ...(role ? { role: role as any } : {}) };
    if (f.product === 'accounts') and.push({ workspaceMemberships: { some: accWhere } });
    else if (f.product === 'work') and.push({ workMemberships: { some: workWhere } });
    else if (f.product === 'executive' && a.admin) and.push({ systemRole: 'SUPER_ADMIN' });
    else if (f.product === 'managers' && a.admin) and.push({ id: { in: (await this.prisma.accessManagerScope.findMany({ select: { userId: true }, distinct: ['userId'] })).map((r) => r.userId) } });
    else if (f.product === 'off' && a.admin) and.push({ id: { in: (await this.prisma.userProductAccess.findMany({ where: { enabled: false }, select: { userId: true } })).map((r) => r.userId) } });
    else if (role) and.push({ OR: [{ workspaceMemberships: { some: accWhere } }, { workMemberships: { some: workWhere } }] });
    const where: Prisma.UserWhereInput = { AND: and };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: USER, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], skip: (page - 1) * take, take }),
    ]);
    return { total, page, pageSize: take, view: a.admin ? 'admin' : 'manager', users: await this.summaries(a, rows) };
  }

  private async summaries(a: Actor, rows: any[]) {
    const ids = rows.map((r) => r.id);
    const prodAdmins = a.admin ? await this.prisma.productAdmin.findMany({ where: { userId: { in: ids } }, select: { userId: true, product: true } }).catch(() => [] as { userId: number; product: string }[]) : [];
    const crm = (a.admin || a.productAdminOf.includes('crm'))
      ? await this.prisma.crmMember.findMany({ where: { userId: { in: ids } }, select: { userId: true, role: true, workspace: { select: { id: true, uid: true, name: true } } } }).catch(() => [] as any[])
      : [];
    const [acc, work, switches, tAdmin, tDev, vault, scopes, boardRows] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId: { in: ids }, deletedAt: null, ...(a.admin ? {} : { workspaceId: { in: this.accWs(a) } }) }, select: { userId: true, role: true, workspace: { select: { id: true, uid: true, name: true } } } }),
      this.prisma.workMember.findMany({ where: { userId: { in: ids }, workspace: { deletedAt: null }, ...(a.admin ? {} : { workspaceId: { in: this.workWs(a) } }) }, select: { userId: true, role: true, workspace: { select: { id: true, uid: true, name: true } } } }),
      this.prisma.userProductAccess.findMany({ where: { userId: { in: ids } }, select: { userId: true, product: true, enabled: true } }),
      this.trackerAdminOf(ids),
      this.trackerDevices(ids),
      this.prisma.vaultUser.findMany({ where: { userId: { in: ids } }, select: { userId: true } }),
      a.admin ? this.prisma.accessManagerScope.findMany({ where: { userId: { in: ids } }, select: { userId: true, product: true, workspaceId: true, source: true, mayGrantAdmin: true } }) : Promise.resolve([] as any[]),
      this.prisma.boardMember.findMany({ where: { userId: { in: ids } }, select: { userId: true, board: { select: { workspaceId: true } } } }),
    ]);
    const vaultSet = new Set(vault.map((v) => v.userId));
    return rows.map((u) => {
      const row = (p: Product) => switches.find((s) => s.userId === u.id && s.product === p);
      const boardsIn = (wsId: number) => boardRows.filter((b) => b.userId === u.id && b.board.workspaceId === wsId).length;
      const accounts = acc.filter((m) => m.userId === u.id).map((m) => ({ workspace: m.workspace, role: m.role, boards: boardsIn(m.workspace.id) }));
      const workRows = work.filter((m) => m.userId === u.id).map((m) => ({ workspace: m.workspace, role: m.role }));
      const state = (p: Product, has: boolean) => {
        const r = row(p);
        if (r) return { on: r.enabled, explicit: true, has };
        return { on: p === 'vault' ? true : has, explicit: false, has };
      };
      const base = {
        ...u,
        products: {
          accounts: { ...state('accounts', accounts.length > 0), companies: accounts },
          work: { ...state('work', workRows.length > 0), companies: workRows },
          tracker: {
            ...state('tracker', accounts.some((x) => TRACKED_ACC.includes(x.role)) || workRows.some((w) => TRACKED_WORK.includes(w.role))),
            trackedCompanies: accounts.filter((x) => TRACKED_ACC.includes(x.role)).length + workRows.filter((w) => TRACKED_WORK.includes(w.role)).length,
            adminOf: tAdmin.get(u.id) ?? 0,
            devices: tDev.get(u.id) ?? 0,
          },
          ...(a.admin || a.productAdminOf.includes('crm') ? {
            crm: { ...state('crm', crm.some((m: any) => m.userId === u.id)), companies: crm.filter((m: any) => m.userId === u.id).map((m: any) => ({ workspace: m.workspace, role: m.role })) },
          } : {}),
          ...(a.admin ? {
            executive: { on: u.systemRole === 'SUPER_ADMIN', locked: true },
            vault: { ...state('vault', true), setUp: vaultSet.has(u.id) },
          } : {}),
        },
        ...(a.admin ? { managerScopes: scopes.filter((s: any) => s.userId === u.id) } : {}),
        ...(a.admin ? { productAdminOf: prodAdmins.filter((p) => p.userId === u.id).map((p) => p.product) } : {}),
      };
      if (!a.admin) { delete (base as any).lastLoginAt; }
      return base;
    });
  }

  private async mustSee(a: Actor, userId: number) {
    const where: Prisma.UserWhereInput = { AND: [{ id: userId, deletedAt: null }, ...(this.visible(a) ? [this.visible(a)!] : [])] };
    const u = await this.prisma.user.findFirst({ where, select: USER });
    if (!u) throw new NotFoundException('User not found.');
    return u;
  }

  async user(a: Actor, id: number) {
    const u = await this.mustSee(a, id);
    const [summary] = await this.summaries(a, [u]);
    const history = await this.history(a, { user: id, pageSize: 50 });
    return { ...summary, history: history.rows };
  }

  /** companies to add someone to (only the actor's companies for an Access Manager) */
  async companies(a: Actor) {
    const accIds = a.admin ? undefined : this.accWs(a), workIds = a.admin ? undefined : this.workWs(a);
    const [acc, work] = await Promise.all([
      this.prisma.workspace.findMany({ where: accIds ? { id: { in: accIds } } : {}, select: { id: true, uid: true, name: true, boards: { select: { id: true, name: true }, orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } }),
      this.prisma.workWorkspace.findMany({ where: { deletedAt: null, ...(workIds ? { id: { in: workIds } } : {}) }, select: { id: true, uid: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const grant = (product: 'accounts' | 'work' | 'tracker', id: number, source?: 'boards' | 'work') => a.admin || !!this.scopeFor(a, product, id, source)?.mayGrantAdmin;
    const manage = (product: 'accounts' | 'work' | 'tracker', id: number, source?: 'boards' | 'work') => a.admin || !!this.scopeFor(a, product, id, source);
    return {
      accounts: acc.filter((w) => manage('accounts', w.id)).map((w) => ({ ...w, mayGrantAdmin: grant('accounts', w.id) })),
      work: work.filter((w) => manage('work', w.id)).map((w) => ({ ...w, mayGrantAdmin: grant('work', w.id) })),
      tracker: a.admin ? { boards: acc.map((w) => ({ id: w.id, name: w.name })), work: work.map((w) => ({ id: w.id, name: w.name })) } : { boards: [], work: [] },
      crm: (a.admin || a.productAdminOf.includes('crm'))
        ? (await this.prisma.crmWorkspace.findMany({ select: { id: true, uid: true, name: true }, orderBy: { name: 'asc' } }))
        : [],
    };
  }

  async history(a: Actor, f: { user?: number; product?: string; action?: string; page?: number; pageSize?: number }) {
    const take = Math.min(200, Math.max(10, f.pageSize ?? 50)), page = Math.max(1, f.page ?? 1);
    const and: Prisma.AccessAuditWhereInput[] = [];
    if (f.user) and.push({ targetUserId: f.user });
    if (f.product) and.push({ product: f.product });
    if (f.action) and.push({ action: f.action });
    if (!a.admin) {
      and.push({ OR: [
        { product: 'accounts', workspaceId: { in: this.accWs(a) } },
        { product: 'work', workspaceId: { in: this.workWs(a) } },
      ] });
    }
    const where: Prisma.AccessAuditWhereInput = and.length ? { AND: and } : {};
    const [total, rows] = await Promise.all([
      this.prisma.accessAudit.count({ where }),
      this.prisma.accessAudit.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * take, take }),
    ]);
    const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.targetUserId]).filter((x): x is number => !!x))];
    const people = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } });
    const by = new Map(people.map((p) => [p.id, p]));
    return { total, page, pageSize: take, rows: rows.map((r) => ({ ...r, actor: r.actorId ? by.get(r.actorId) ?? null : null, target: r.targetUserId ? by.get(r.targetUserId) ?? null : null })) };
  }

  // ── product switch (Administrator) ──

  async setProduct(a: Actor, userIds: number[], product: Product, enabled: boolean) {
    this.needAdmin(a);
    if (!PRODUCTS.includes(product)) throw new BadRequestException('Unknown product.');
    if (product === 'executive') throw new BadRequestException('Executive Hub is for Administrators: make someone a Co-Administrator instead.');
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] }, deletedAt: null }, select: { id: true } });
    if (!users.length) throw new NotFoundException('No such users.');
    for (const u of users) {
      const was = !(await this.products.isOff(u.id, product));
      await this.products.set(u.id, product, enabled, a.id);
      if (was !== enabled) this.audit.record({ actorId: a.id, targetUserId: u.id, product, action: enabled ? 'product_on' : 'product_off', via: 'access_center' });
    }
    return { updated: users.length };
  }

  // ── Accounts & Invoices ──

  private async target(id: number) {
    const u = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, email: true, systemRole: true, status: true } });
    if (!u) throw new NotFoundException('User not found.');
    return u;
  }

  async addAccounts(a: Actor, userId: number, dto: { workspaceId: number; role: string; boardIds?: number[] }, opts: { silent?: boolean } = {}) {
    const u = await this.target(userId);
    const role = String(dto.role).toUpperCase() as WorkspaceMemberRole;
    if (!ACC_ROLES.includes(role)) throw new BadRequestException('Pick Admin, Member, Viewer or Guest.');
    this.need(a, 'accounts', dto.workspaceId, role);
    const ws = await this.prisma.workspace.findUnique({ where: { id: dto.workspaceId }, select: { id: true, name: true, boards: { select: { id: true } } } });
    if (!ws) throw new NotFoundException('Company not found.');
    const member = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId } } });
    if (member && !member.deletedAt) throw new BadRequestException(`Already in ${ws.name} — change the role instead.`);
    await this.products.allowInvite(userId, 'accounts', a.id);
    // removed earlier → their soft-deleted row comes back with the new role
    if (member?.deletedAt) await this.prisma.workspaceMember.update({ where: { id: member.id }, data: { deletedAt: null, role } });
    const boardIds = dto.boardIds?.length ? dto.boardIds : ws.boards.map((b) => b.id);
    if (boardIds.length) {
      await this.invitations.create({ email: u.email, workspaceId: ws.id, role, boardIds } as any, a.id, 'access_center', { authorized: true, silent: opts.silent });
    } else {
      if (!member) await this.prisma.workspaceMember.create({ data: { workspaceId: ws.id, userId, role } });
      this.audit.record({ actorId: a.id, targetUserId: userId, product: 'accounts', workspaceId: ws.id, action: 'added', toRole: role, via: 'access_center' });
    }
    if (member?.deletedAt && boardIds.length === 0) { /* recorded above */ }
    return { company: ws.name, role };
  }

  private async accountsMember(userId: number, workspaceId: number) {
    const m = await this.prisma.workspaceMember.findFirst({ where: { userId, workspaceId, deletedAt: null } });
    if (!m) throw new NotFoundException('Not in this company.');
    return m;
  }

  async roleAccounts(a: Actor, userId: number, workspaceId: number, role: string) {
    const r = String(role).toUpperCase() as WorkspaceMemberRole;
    if (!ACC_ROLES.includes(r)) throw new BadRequestException('Pick Admin, Member, Viewer or Guest.');
    const m = await this.accountsMember(userId, workspaceId);
    this.need(a, 'accounts', workspaceId, ADMINISH.includes(m.role) ? 'ADMIN' : r);
    await this.workspaces.updateMemberRole(workspaceId, m.id, r, a.id);
    return this.user(a, userId);
  }

  async removeAccounts(a: Actor, userId: number, workspaceId: number) {
    const m = await this.accountsMember(userId, workspaceId);
    this.need(a, 'accounts', workspaceId, m.role);
    await this.workspaces.removeMember(workspaceId, m.id, a.id, false);
    return this.user(a, userId);
  }

  // ── Company Work ──

  async addWork(a: Actor, userId: number, dto: { workspaceId: number; role: string }, opts: { silent?: boolean } = {}) {
    const u = await this.target(userId);
    const role = String(dto.role).toUpperCase() as WorkRoleName;
    if (!WORK_ROLES.includes(role)) throw new BadRequestException('Pick Admin, Member, Limited member or Guest.');
    this.need(a, 'work', dto.workspaceId, role);
    const ws = await this.prisma.workWorkspace.findFirst({ where: { id: dto.workspaceId, deletedAt: null }, select: { name: true } });
    if (!ws) throw new NotFoundException('Company not found.');
    const exists = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId: dto.workspaceId, userId } } });
    if (exists) throw new BadRequestException(`Already in ${ws.name} — change the role instead.`);
    const r = await this.workPeople.invite(dto.workspaceId, a.id, [u.email], role, 'access_center', { authorized: true, silent: opts.silent });
    if (r.results[0]?.status === 'no_access') throw new BadRequestException("This person doesn't have access to Company Work. Ask the Administrator to turn it on.");
    return { company: ws.name, role };
  }

  async roleWork(a: Actor, userId: number, workspaceId: number, role: string) {
    const r = String(role).toUpperCase() as WorkRoleName;
    if (!WORK_ROLES.includes(r)) throw new BadRequestException('Pick Admin, Member, Limited member or Guest.');
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m) throw new NotFoundException('Not in this company.');
    this.need(a, 'work', workspaceId, ADMINISH.includes(m.role) ? 'ADMIN' : r);
    await this.workPeople.changeRole(workspaceId, a.id, userId, r, { authorized: true });
    return this.user(a, userId);
  }

  async removeWork(a: Actor, userId: number, workspaceId: number) {
    const m = await this.prisma.workMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m) throw new NotFoundException('Not in this company.');
    this.need(a, 'work', workspaceId, m.role);
    await this.workPeople.remove(workspaceId, a.id, userId, { authorized: true });
    return this.user(a, userId);
  }

  // ── EZ CRM ──

  private needCrmAdmin(a: Actor) {
    if (!a.admin && !a.productAdminOf.includes('crm')) throw new ForbiddenException('Only the Administrator or the EZ CRM Administrator can manage CRM people.');
  }

  async addCrm(a: Actor, userId: number, dto: { workspaceId: number; role: string }) {
    this.needCrmAdmin(a);
    await this.target(userId);
    const role = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(String(dto.role).toUpperCase()) ? String(dto.role).toUpperCase() : 'MEMBER';
    const ws = await this.prisma.crmWorkspace.findFirst({ where: { id: Number(dto.workspaceId) }, select: { id: true, name: true } });
    if (!ws) throw new NotFoundException('CRM workspace not found.');
    const had = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId } } });
    if (had) throw new BadRequestException(`Already in ${ws.name} — change the role instead.`);
    await this.products.allowInvite(userId, 'crm', a.id);
    await this.prisma.crmMember.create({ data: { workspaceId: ws.id, userId, role } });
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'crm', workspaceId: ws.id, workspaceName: ws.name, action: 'added', toRole: role, via: 'access_center' });
    return { company: ws.name, role };
  }

  async roleCrm(a: Actor, userId: number, workspaceId: number, role: string) {
    this.needCrmAdmin(a);
    const r = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(String(role).toUpperCase()) ? String(role).toUpperCase() : null;
    if (!r) throw new BadRequestException('Pick Owner, Admin, Member or Viewer.');
    const m = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m) throw new NotFoundException('Not in this CRM.');
    if (m.role === 'OWNER' && r !== 'OWNER' && (await this.prisma.crmMember.count({ where: { workspaceId, role: 'OWNER' } })) <= 1) throw new BadRequestException('A CRM needs at least one owner.');
    await this.prisma.crmMember.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role: r } });
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'crm', workspaceId, action: 'role_changed', fromRole: m.role, toRole: r, via: 'access_center' });
    return this.user(a, userId);
  }

  async removeCrm(a: Actor, userId: number, workspaceId: number) {
    this.needCrmAdmin(a);
    const m = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m) throw new NotFoundException('Not in this CRM.');
    if (m.role === 'OWNER' && (await this.prisma.crmMember.count({ where: { workspaceId, role: 'OWNER' } })) <= 1) throw new BadRequestException('A CRM needs at least one owner.');
    await this.prisma.crmMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
    await Promise.all([
      this.prisma.crmContact.updateMany({ where: { workspaceId, ownerId: userId }, data: { ownerId: null } }),
      this.prisma.crmCompany.updateMany({ where: { workspaceId, ownerId: userId }, data: { ownerId: null } }),
      this.prisma.crmDeal.updateMany({ where: { workspaceId, ownerId: userId }, data: { ownerId: null } }),
    ]);
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'crm', workspaceId, action: 'removed', fromRole: m.role, via: 'access_center' });
    return this.user(a, userId);
  }

  // ── EZ Tracker (through the Tracker's own service, when it is there) ──

  private trackerService(): any {
    try {
      // the Tracker module is optional for the Access Center (it may not be loaded)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TrackerService } = require('../tracker/tracker.service');
      return this.moduleRef.get(TrackerService, { strict: false });
    } catch { return null; }
  }

  async addTracker(a: Actor, userId: number, dto: { source: 'boards' | 'work'; workspaceId: number; role: 'member' | 'admin' }) {
    this.needAdmin(a); // the Tracker checks its own managers; from here only Administrators add people
    const svc = this.trackerService();
    if (!svc?.addMembers) throw new BadRequestException('EZ Tracker people come with the Tracker update.');
    const ws = dto.source === 'boards'
      ? await this.prisma.workspace.findUnique({ where: { id: dto.workspaceId }, select: { uid: true, name: true } })
      : await this.prisma.workWorkspace.findFirst({ where: { id: dto.workspaceId, deletedAt: null }, select: { uid: true, name: true } });
    if (!ws) throw new NotFoundException('Company not found.');
    const key = `${dto.source === 'boards' ? 'b' : 'w'}-${ws.uid}`;
    await svc.addMembers(key, a.id, { userIds: [userId], role: dto.role === 'admin' ? 'admin' : 'member' });
    await this.products.set(userId, 'tracker', true, a.id);
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'tracker', workspaceId: dto.workspaceId, workspaceName: ws.name, action: 'added', toRole: dto.role, via: 'access_center' });
    return { company: ws.name, role: dto.role };
  }

  // ── Invite people (one place, every product) ──

  async invite(a: Actor, b: InviteBody) {
    const emails = [...new Set((b.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))].slice(0, 50);
    if (!emails.length) throw new BadRequestException('Add at least one email.');
    const bad = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (bad.length) throw new BadRequestException(`Not a valid email: ${bad.join(', ')}`);
    if (!b.accounts && !b.work && !b.tracker && !b.crm && !b.vault) throw new BadRequestException('Pick at least one product.');
    // check every permission before changing anything
    if (b.accounts) this.need(a, 'accounts', Number(b.accounts.workspaceId), b.accounts.role);
    if (b.work) this.need(a, 'work', Number(b.work.workspaceId), b.work.role);
    if (b.tracker || b.vault) this.needAdmin(a);
    if (b.crm) this.needCrmAdmin(a);
    const inviter = await this.prisma.user.findUnique({ where: { id: a.id }, select: { firstName: true, lastName: true } });
    const inviterName = `${inviter?.firstName ?? ''} ${inviter?.lastName ?? ''}`.trim() || 'Your administrator';
    const results: { email: string; existing: boolean; given: string[]; problems: string[] }[] = [];
    for (const email of emails) {
      const user = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
      const given: string[] = [], problems: string[] = [];
      const tryIt = async (label: string, fn: () => Promise<{ company: string; role: string } | void>) => {
        try { const r = await fn(); given.push(r ? `${label} — ${r.company} as ${ROLE(r.role)}` : label); }
        catch (e: any) { problems.push(`${label}: ${e?.response?.message ?? e?.message ?? 'failed'}`); }
      };
      if (user) {
        if (b.accounts) await tryIt(PRODUCT_LABEL.accounts, () => this.addAccounts(a, user.id, { workspaceId: Number(b.accounts!.workspaceId), role: b.accounts!.role, boardIds: b.accounts!.boardIds }));
        if (b.work) await tryIt(PRODUCT_LABEL.work, () => this.addWork(a, user.id, { workspaceId: Number(b.work!.workspaceId), role: b.work!.role }));
        if (b.tracker) await tryIt(PRODUCT_LABEL.tracker, () => this.addTracker(a, user.id, b.tracker!));
        if (b.crm) await tryIt(PRODUCT_LABEL.crm, () => this.addCrm(a, user.id, { workspaceId: Number(b.crm!.workspaceId), role: b.crm!.role }));
        if (b.vault) await tryIt(PRODUCT_LABEL.vault, async () => { if (await this.products.isOff(user.id, 'vault')) await this.setProduct(a, [user.id], 'vault', true); });
        results.push({ email, existing: true, given, problems });
        continue;
      }
      // new email: each product's own invitation (no email of their own), then ONE combined email
      let link: string | null = null;
      if (b.accounts) {
        await tryIt(PRODUCT_LABEL.accounts, async () => {
          const ws = await this.prisma.workspace.findUnique({ where: { id: Number(b.accounts!.workspaceId) }, select: { name: true, boards: { select: { id: true } } } });
          if (!ws) throw new NotFoundException('Company not found.');
          const boardIds = b.accounts!.boardIds?.length ? b.accounts!.boardIds : ws.boards.map((x) => x.id);
          if (!boardIds.length) throw new BadRequestException(`${ws.name} has no boards yet; add a board first.`);
          const r: any = await this.invitations.create({ email, workspaceId: Number(b.accounts!.workspaceId), role: String(b.accounts!.role).toUpperCase(), boardIds } as any, a.id, 'access_center', { authorized: true, silent: true });
          link ??= r?.token ? `${process.env.FRONTEND_URL}/setup-account?token=${r.token}` : null;
          return { company: ws.name, role: String(b.accounts!.role).toUpperCase() };
        });
      }
      if (b.work) {
        await tryIt(PRODUCT_LABEL.work, async () => {
          const ws = await this.prisma.workWorkspace.findFirst({ where: { id: Number(b.work!.workspaceId), deletedAt: null }, select: { name: true } });
          if (!ws) throw new NotFoundException('Company not found.');
          const role = String(b.work!.role).toUpperCase() as WorkRoleName;
          if (!WORK_ROLES.includes(role)) throw new BadRequestException('Pick Admin, Member, Limited member or Guest.');
          await this.workPeople.invite(Number(b.work!.workspaceId), a.id, [email], role, 'access_center', { authorized: true, silent: true });
          const inv = await this.prisma.workInvitation.findFirst({ where: { workspaceId: Number(b.work!.workspaceId), email: { equals: email, mode: 'insensitive' }, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, select: { token: true } });
          // Accounts' sign-up also applies pending Company Work invitations, so its link covers both
          link ??= inv ? `${process.env.FRONTEND_URL}/setup-account?token=${inv.token}` : null;
          return { company: ws.name, role };
        });
      }
      if (b.tracker) problems.push(`${PRODUCT_LABEL.tracker}: can be added once they have signed up.`);
      if (b.crm) {
        await tryIt(PRODUCT_LABEL.crm, async () => {
          const ws = await this.prisma.crmWorkspace.findFirst({ where: { id: Number(b.crm!.workspaceId) }, select: { name: true } });
          if (!ws) throw new NotFoundException('CRM not found.');
          const role = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(String(b.crm!.role).toUpperCase()) ? String(b.crm!.role).toUpperCase() : 'MEMBER';
          const open = await this.prisma.crmInvitation.findFirst({ where: { workspaceId: Number(b.crm!.workspaceId), email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } });
          const token = open ? null : randomBytes(24).toString('base64url');
          if (token) await this.prisma.crmInvitation.create({ data: { workspaceId: Number(b.crm!.workspaceId), email, role, token, invitedById: a.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
          link ??= token ? `${process.env.FRONTEND_URL}/setup-account?token=${token}` : null;
          return { company: ws.name, role };
        });
      }
      if (b.vault) given.push(`${PRODUCT_LABEL.vault} (every account has it)`);
      if (link && given.length) await this.combinedEmail(email, inviterName, given, link);
      results.push({ email, existing: false, given, problems });
    }
    return { results };
  }

  private async combinedEmail(to: string, inviterName: string, given: string[], link: string) {
    const items = given.map((g) => `<li>${esc(g)}</li>`).join('');
    try {
      await this.mail.sendMail({
        to,
        subject: `${inviterName} invited you to EZ Manage`,
        html: `<p>${esc(inviterName)} invited you to EZ Manage. You get:</p><ul>${items}</ul><p><a href="${link}">Set up your account</a> — one sign-up opens all of them. The link expires in 7 days.</p>`,
        text: `${inviterName} invited you to EZ Manage. You get:\n${given.map((g) => `- ${g}`).join('\n')}\n\nSet up your account: ${link} (expires in 7 days)`,
      });
    } catch (e: any) { this.log.warn(`combined invite email failed: ${e?.message ?? e}`); }
  }

  // ── system roles (Administrator / Co-Administrator) ──

  async setSystemRole(a: Actor, userId: number, role: 'SUPER_ADMIN' | 'USER') {
    this.needAdmin(a);
    if (role !== 'SUPER_ADMIN' && role !== 'USER') throw new BadRequestException('Unknown role.');
    const u = await this.target(userId);
    if (u.systemRole === role) return this.user(a, userId);
    if (role === 'USER') {
      const admins = await this.prisma.user.count({ where: { systemRole: 'SUPER_ADMIN', deletedAt: null, status: 'ACTIVE' } });
      if (admins <= 1) throw new ForbiddenException('There must always be at least one Administrator.');
    } else if (u.status !== 'ACTIVE') {
      throw new BadRequestException('Enable the account first.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { systemRole: role } });
    // their sign-in carries the role: end it so the new role applies at once
    await this.prisma.$executeRaw`DELETE FROM sessions WHERE (sess::jsonb -> 'user' ->> 'id') = ${String(userId)}`;
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'system', action: role === 'SUPER_ADMIN' ? 'promoted' : 'demoted', fromRole: u.systemRole, toRole: role, via: 'access_center' });
    return this.user(a, userId);
  }

  // ── Access Managers (Administrator) ──

  async setScopes(a: Actor, userId: number, scopes: { product: string; workspaceId: number; source?: string | null; mayGrantAdmin?: boolean }[]) {
    this.needAdmin(a);
    const u = await this.target(userId);
    if (u.systemRole === 'SUPER_ADMIN') throw new BadRequestException('Administrators already manage everything.');
    const clean: Scope[] = [];
    for (const s of scopes ?? []) {
      const product = s.product as Scope['product'];
      if (!['accounts', 'work', 'tracker'].includes(product)) throw new BadRequestException('Unknown product.');
      const workspaceId = Number(s.workspaceId);
      if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new BadRequestException('Pick a company.');
      const source = product === 'tracker' ? (s.source === 'boards' ? 'boards' : 'work') : null;
      const kind = product === 'accounts' || source === 'boards' ? 'boards' : 'work';
      const ok = kind === 'boards'
        ? await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })
        : await this.prisma.workWorkspace.findFirst({ where: { id: workspaceId, deletedAt: null }, select: { id: true } });
      if (!ok) throw new NotFoundException('Company not found.');
      clean.push({ product, workspaceId, source, mayGrantAdmin: !!s.mayGrantAdmin });
    }
    const before = await this.prisma.accessManagerScope.findMany({ where: { userId } });
    await this.prisma.$transaction([
      this.prisma.accessManagerScope.deleteMany({ where: { userId } }),
      ...clean.map((s) => this.prisma.accessManagerScope.create({ data: { userId, product: s.product, workspaceId: s.workspaceId, source: s.source, mayGrantAdmin: s.mayGrantAdmin, grantedById: a.id } })),
    ]);
    if (before.length !== clean.length || JSON.stringify(before.map((x) => [x.product, x.workspaceId, x.mayGrantAdmin])) !== JSON.stringify(clean.map((x) => [x.product, x.workspaceId, x.mayGrantAdmin]))) {
      this.audit.record({ actorId: a.id, targetUserId: userId, product: 'system', action: clean.length ? 'manager_set' : 'manager_removed', toRole: clean.length ? `${clean.length} companies` : null, via: 'access_center' });
    }
    return this.user(a, userId);
  }

  // ── account on / off (Administrator) ──

  async disable(a: Actor, userId: number) {
    this.needAdmin(a);
    const u = await this.target(userId);
    if (u.id === a.id) throw new ForbiddenException("You can't disable your own account.");
    if (u.systemRole === 'SUPER_ADMIN') throw new ForbiddenException('Remove the Administrator role first.');
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    await this.prisma.$executeRaw`DELETE FROM sessions WHERE (sess::jsonb -> 'user' ->> 'id') = ${String(userId)}`;
    await this.prisma.trackerDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => null);
    await this.prisma.vaultToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => null);
    // shared vaults: leave them, unless they are the only owner (the vault would be locked forever)
    const shared = await this.prisma.vaultMember.findMany({ where: { userId, vault: { kind: { not: 'personal' }, deletedAt: null } }, select: { vaultId: true, role: true } });
    let left = 0, kept = 0;
    for (const s of shared) {
      if (s.role === 'owner' && (await this.prisma.vaultMember.count({ where: { vaultId: s.vaultId, role: 'owner' } })) <= 1) { kept++; continue; }
      await this.prisma.vaultMember.delete({ where: { vaultId_userId: { vaultId: s.vaultId, userId } } });
      left++;
    }
    this.products.forget(userId);
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'system', action: 'disabled', via: 'access_center' });
    return { disabled: true, leftSharedVaults: left, keptAsOnlyOwner: kept };
  }

  async enable(a: Actor, userId: number) {
    this.needAdmin(a);
    await this.target(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    this.audit.record({ actorId: a.id, targetUserId: userId, product: 'system', action: 'enabled', via: 'access_center' });
    return { enabled: true };
  }
}
