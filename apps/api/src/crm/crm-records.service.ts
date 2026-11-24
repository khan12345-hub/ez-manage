import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { CrmAccessService, type CrmCtx } from './crm-access.service';
import type { ActivityDto, BulkDto, CompanyDto, ContactDto, DealDto, MoveDealDto, UpdateActivityDto } from './dto/crm.dto';

type Obj = 'contact' | 'company' | 'deal';
type Q = Record<string, string | undefined>;
const USER = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } as const;
const money = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0);
const day0 = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const SORTS: Record<Obj, string[]> = {
  contact: ['firstName', 'lastName', 'email', 'lifecycle', 'createdAt', 'updatedAt', 'lastActivityAt'],
  company: ['name', 'domain', 'industry', 'createdAt', 'updatedAt', 'lastActivityAt'],
  deal: ['name', 'amount', 'closeDate', 'createdAt', 'updatedAt', 'lastActivityAt'],
};
const nameOf = (u?: { firstName: string | null; lastName: string | null } | null) => (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '');

/** EZ Sales records: companies, contacts, deals, activities, timeline, bulk actions, home summary. */
@Injectable()
export class CrmRecordsService {
  private readonly log = new Logger('Crm');
  constructor(private readonly prisma: PrismaService, private readonly access: CrmAccessService, private readonly notifications: NotificationsService) {}

  // ── helpers ──
  private async users(ids: (number | null | undefined)[]) {
    const want = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
    if (!want.length) return new Map<number, any>();
    const rows = await this.prisma.user.findMany({ where: { id: { in: want } }, select: USER });
    return new Map(rows.map((u) => [u.id, u]));
  }

  private async event(workspaceId: number, userId: number, link: { contactId?: number; companyId?: number; dealId?: number }, event: string, meta: Record<string, unknown> = {}) {
    await this.prisma.crmActivity.create({ data: { workspaceId, kind: 'event', ownerId: userId, ...link, meta: { event, ...meta } as object } });
  }

  /** in-app notice (no email) in the CRM's own inbox when someone gets a record or a task */
  private async tell(recipientId: number | null | undefined, actorId: number, title: string, message: string, href: string) {
    if (!recipientId || recipientId === actorId) return;
    await this.notifications.notify({ recipientId, type: NotificationType.TASK_ASSIGNED, title, message, product: 'crm', sendEmail: false, metadata: { href, actorId } }).catch((e) => this.log.warn(`notify failed: ${e?.message}`));
  }

  private customWhere(q: Q): Prisma.JsonFilter[] {
    return Object.entries(q).filter(([k, v]) => k.startsWith('f_') && v !== undefined && v !== '').slice(0, 10).map(([k, v]) => {
      const key = k.slice(2).replace(/[^a-z0-9_]/gi, '');
      const val: unknown = v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?$/.test(v!) ? Number(v) : v;
      return Array.isArray(val) ? { path: [key], array_contains: val } : ({ path: [key], equals: val } as Prisma.JsonFilter);
    });
  }

  private paging(q: Q) {
    const page = Math.max(1, Math.min(10_000, Number(q.page) || 1));
    const pageSize = Math.max(1, Math.min(200, Number(q.pageSize) || 50));
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
  }

  private order(obj: Obj, q: Q) {
    const field = SORTS[obj].includes(q.sort ?? '') ? q.sort! : 'createdAt';
    const dir = q.dir === 'asc' ? 'asc' : 'desc';
    // nulls placement is only allowed on optional columns
    const optional = ['email', 'domain', 'industry', 'closeDate', 'lastActivityAt'].includes(field);
    return [{ [field]: optional ? { sort: dir, nulls: 'last' } : dir }, { id: 'desc' }] as any;
  }

  private ownerWhere(q: Q, userId: number) {
    if (!q.owner) return {};
    if (q.owner === 'me') return { ownerId: userId };
    if (q.owner === 'none') return { ownerId: null };
    const n = Number(q.owner);
    return Number.isInteger(n) ? { ownerId: n } : {};
  }

  private dateRange(from?: string, to?: string) {
    const f = from && !isNaN(+new Date(from)) ? new Date(from) : undefined;
    const t = to && !isNaN(+new Date(to)) ? new Date(to) : undefined;
    return f || t ? { ...(f && { gte: f }), ...(t && { lte: t }) } : undefined;
  }

  private async own<T extends 'crmContact' | 'crmCompany' | 'crmDeal'>(model: T, id: number, workspaceId: number) {
    const row = await (this.prisma[model] as any).findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Record not found.');
    return row;
  }

  private async checkLinks(workspaceId: number, l: { companyId?: number | null; contactIds?: number[]; contactId?: number | null; dealId?: number | null }) {
    if (l.companyId) await this.own('crmCompany', l.companyId, workspaceId);
    if (l.contactId) await this.own('crmContact', l.contactId, workspaceId);
    if (l.dealId) await this.own('crmDeal', l.dealId, workspaceId);
    if (l.contactIds?.length) {
      const n = await this.prisma.crmContact.count({ where: { workspaceId, id: { in: [...new Set(l.contactIds)] } } });
      if (n !== new Set(l.contactIds).size) throw new BadRequestException('A contact is not in this CRM.');
    }
  }

  private href(ws: string, obj: Obj, id: number) {
    return `/crm/${ws}/${obj === 'contact' ? 'contacts' : obj === 'company' ? 'companies' : 'deals'}/${id}`;
  }

  // ── companies ──
  async listCompanies(wsUid: string, userId: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    const s = q.q?.trim();
    const where: Prisma.CrmCompanyWhereInput = {
      workspaceId: ws.id, ...this.ownerWhere(q, userId),
      ...(s && { OR: [{ name: { contains: s, mode: 'insensitive' } }, { domain: { contains: s, mode: 'insensitive' } }, { industry: { contains: s, mode: 'insensitive' } }] }),
      ...(q.industry && { industry: q.industry }),
      ...(this.dateRange(q.createdFrom, q.createdTo) && { createdAt: this.dateRange(q.createdFrom, q.createdTo) }),
      AND: this.customWhere(q).map((f) => ({ custom: f })),
    };
    const { page, pageSize, skip, take } = this.paging(q);
    const [rows, total] = await Promise.all([
      this.prisma.crmCompany.findMany({ where, orderBy: this.order('company', q), skip, take, include: { _count: { select: { contacts: true, deals: true } } } }),
      this.prisma.crmCompany.count({ where }),
    ]);
    const open = await this.prisma.crmDeal.groupBy({ by: ['companyId'], where: { companyId: { in: rows.map((r) => r.id) }, wonAt: null, lostAt: null }, _sum: { amount: true } });
    const ov = new Map(open.map((o) => [o.companyId, money(o._sum.amount)]));
    const users = await this.users(rows.map((r) => r.ownerId));
    return { total, page, pageSize, rows: rows.map(({ _count, ...r }) => ({ ...r, owner: r.ownerId ? users.get(r.ownerId) ?? null : null, contacts: _count.contacts, deals: _count.deals, openValue: ov.get(r.id) ?? 0 })) };
  }

  async company(wsUid: string, userId: number, id: number) {
    const { ws } = await this.access.ws(wsUid, userId);
    const c = await this.prisma.crmCompany.findFirst({ where: { id, workspaceId: ws.id }, include: {
      contacts: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, firstName: true, lastName: true, email: true, title: true, lifecycle: true } },
      deals: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, name: true, amount: true, closeDate: true, stage: { select: { id: true, name: true, isWon: true, isLost: true } } } },
    } });
    if (!c) throw new NotFoundException('Company not found.');
    const users = await this.users([c.ownerId, c.createdById]);
    return { ...c, deals: c.deals.map((d) => ({ ...d, amount: money(d.amount) })), owner: c.ownerId ? users.get(c.ownerId) ?? null : null, createdBy: users.get(c.createdById) ?? null };
  }

  async createCompany(wsUid: string, userId: number, dto: CompanyDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    if (!dto.name?.trim()) throw new BadRequestException('Company name is required.');
    const ownerId = dto.ownerId === undefined ? userId : dto.ownerId;
    await this.access.requireMembers(ws.id, [ownerId]);
    const c = await this.prisma.crmCompany.create({ data: { workspaceId: ws.id, name: dto.name.trim(), domain: dto.domain ?? null, industry: dto.industry ?? null, size: dto.size ?? null, phone: dto.phone ?? null, city: dto.city ?? null, country: dto.country ?? null, ownerId, custom: (dto.custom ?? {}) as object, createdById: userId } });
    await this.event(ws.id, userId, { companyId: c.id }, 'created');
    await this.tell(ownerId, userId, 'Company assigned to you', `“${c.name}” is now yours.`, this.href(ws.uid, 'company', c.id));
    return c;
  }

  async updateCompany(wsUid: string, userId: number, id: number, dto: CompanyDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const before = await this.own('crmCompany', id, ws.id);
    await this.access.requireMembers(ws.id, [dto.ownerId]);
    const { custom, name, ...rest } = dto;
    const c = await this.prisma.crmCompany.update({ where: { id }, data: { ...rest, ...(name !== undefined && { name: name.trim() }), ...(custom && { custom: { ...(before.custom as object), ...custom } as object }) } });
    if (dto.ownerId !== undefined && dto.ownerId !== before.ownerId) {
      await this.event(ws.id, userId, { companyId: id }, 'owner_changed', { from: before.ownerId, to: dto.ownerId });
      await this.tell(dto.ownerId, userId, 'Company assigned to you', `“${c.name}” is now yours.`, this.href(ws.uid, 'company', id));
    }
    return c;
  }

  // ── contacts ──
  async listContacts(wsUid: string, userId: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    const s = q.q?.trim();
    const words = s?.split(/\s+/).filter(Boolean).slice(0, 3) ?? [];
    const where: Prisma.CrmContactWhereInput = {
      workspaceId: ws.id, ...this.ownerWhere(q, userId),
      ...(q.lifecycle && { lifecycle: q.lifecycle }),
      ...(q.leadStatus && { leadStatus: q.leadStatus }),
      ...(q.companyId && Number(q.companyId) && { companyId: Number(q.companyId) }),
      ...(this.dateRange(q.createdFrom, q.createdTo) && { createdAt: this.dateRange(q.createdFrom, q.createdTo) }),
      AND: [
        ...words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' as const } }, { lastName: { contains: w, mode: 'insensitive' as const } }, { email: { contains: w, mode: 'insensitive' as const } }, { phone: { contains: w } }, { company: { name: { contains: w, mode: 'insensitive' as const } } }] })),
        ...this.customWhere(q).map((f) => ({ custom: f })),
      ],
    };
    const { page, pageSize, skip, take } = this.paging(q);
    const [rows, total] = await Promise.all([
      this.prisma.crmContact.findMany({ where, orderBy: this.order('contact', q), skip, take, include: { company: { select: { id: true, name: true } }, _count: { select: { deals: true } } } }),
      this.prisma.crmContact.count({ where }),
    ]);
    const users = await this.users(rows.map((r) => r.ownerId));
    return { total, page, pageSize, rows: rows.map(({ _count, ...r }) => ({ ...r, owner: r.ownerId ? users.get(r.ownerId) ?? null : null, deals: _count.deals })) };
  }

  async contact(wsUid: string, userId: number, id: number) {
    const { ws } = await this.access.ws(wsUid, userId);
    const c = await this.prisma.crmContact.findFirst({ where: { id, workspaceId: ws.id }, include: {
      company: { select: { id: true, name: true, domain: true } },
      deals: { include: { deal: { select: { id: true, name: true, amount: true, closeDate: true, stage: { select: { id: true, name: true, isWon: true, isLost: true } } } } } },
    } });
    if (!c) throw new NotFoundException('Contact not found.');
    const users = await this.users([c.ownerId, c.createdById]);
    return { ...c, deals: c.deals.map((x) => ({ ...x.deal, amount: money(x.deal.amount) })), owner: c.ownerId ? users.get(c.ownerId) ?? null : null, createdBy: users.get(c.createdById) ?? null };
  }

  async createContact(wsUid: string, userId: number, dto: ContactDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    if (!dto.firstName?.trim()) throw new BadRequestException('First name is required.');
    const ownerId = dto.ownerId === undefined ? userId : dto.ownerId;
    await this.access.requireMembers(ws.id, [ownerId]);
    await this.checkLinks(ws.id, { companyId: dto.companyId });
    if (dto.email) {
      const dup = await this.prisma.crmContact.findFirst({ where: { workspaceId: ws.id, email: { equals: dto.email, mode: 'insensitive' } }, select: { id: true } });
      if (dup) throw new BadRequestException(`A contact with this email already exists (#${dup.id}).`);
    }
    const c = await this.prisma.crmContact.create({ data: {
      workspaceId: ws.id, firstName: dto.firstName.trim(), lastName: dto.lastName?.trim() ?? '', email: dto.email?.trim().toLowerCase() ?? null, phone: dto.phone ?? null, title: dto.title ?? null,
      companyId: dto.companyId ?? null, ownerId, lifecycle: dto.lifecycle ?? 'lead', leadStatus: dto.leadStatus ?? 'new', source: dto.source ?? null, custom: (dto.custom ?? {}) as object, createdById: userId,
    } });
    await this.event(ws.id, userId, { contactId: c.id }, 'created');
    await this.tell(ownerId, userId, 'Contact assigned to you', `${c.firstName} ${c.lastName}`.trim() + ' is now yours.', this.href(ws.uid, 'contact', c.id));
    return c;
  }

  async updateContact(wsUid: string, userId: number, id: number, dto: ContactDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const before = await this.own('crmContact', id, ws.id);
    await this.access.requireMembers(ws.id, [dto.ownerId]);
    await this.checkLinks(ws.id, { companyId: dto.companyId });
    if (dto.email && dto.email.toLowerCase() !== before.email) {
      const dup = await this.prisma.crmContact.findFirst({ where: { workspaceId: ws.id, email: { equals: dto.email, mode: 'insensitive' }, NOT: { id } }, select: { id: true } });
      if (dup) throw new BadRequestException(`A contact with this email already exists (#${dup.id}).`);
    }
    const { custom, firstName, lastName, email, ...rest } = dto;
    const c = await this.prisma.crmContact.update({ where: { id }, data: {
      ...rest, ...(firstName !== undefined && { firstName: firstName.trim() }), ...(lastName !== undefined && { lastName: lastName.trim() }),
      ...(email !== undefined && { email: email ? email.trim().toLowerCase() : null }),
      ...(custom && { custom: { ...(before.custom as object), ...custom } as object }),
    } });
    if (dto.lifecycle && dto.lifecycle !== before.lifecycle) await this.event(ws.id, userId, { contactId: id }, 'lifecycle_changed', { from: before.lifecycle, to: dto.lifecycle });
    if (dto.ownerId !== undefined && dto.ownerId !== before.ownerId) {
      await this.event(ws.id, userId, { contactId: id }, 'owner_changed', { from: before.ownerId, to: dto.ownerId });
      await this.tell(dto.ownerId, userId, 'Contact assigned to you', `${c.firstName} ${c.lastName}`.trim() + ' is now yours.', this.href(ws.uid, 'contact', id));
    }
    if (dto.companyId !== undefined && dto.companyId !== before.companyId) await this.event(ws.id, userId, { contactId: id }, 'company_changed', { from: before.companyId, to: dto.companyId });
    return c;
  }

  // ── deals ──
  private dealWhere(ws: CrmCtx['ws'], userId: number, q: Q): Prisma.CrmDealWhereInput {
    const s = q.q?.trim();
    return {
      workspaceId: ws.id, ...this.ownerWhere(q, userId),
      ...(q.pipelineId && Number(q.pipelineId) && { pipelineId: Number(q.pipelineId) }),
      ...(q.stageId && Number(q.stageId) && { stageId: Number(q.stageId) }),
      ...(q.companyId && Number(q.companyId) && { companyId: Number(q.companyId) }),
      ...(q.status === 'open' && { wonAt: null, lostAt: null }),
      ...(q.status === 'won' && { wonAt: { not: null } }),
      ...(q.status === 'lost' && { lostAt: { not: null } }),
      ...(q.priority && { priority: q.priority }),
      ...(this.dateRange(q.closeFrom, q.closeTo) && { closeDate: this.dateRange(q.closeFrom, q.closeTo) }),
      ...(this.dateRange(q.createdFrom, q.createdTo) && { createdAt: this.dateRange(q.createdFrom, q.createdTo) }),
      AND: [
        ...(s ? [{ OR: [{ name: { contains: s, mode: 'insensitive' as const } }, { company: { name: { contains: s, mode: 'insensitive' as const } } }] }] : []),
        ...this.customWhere(q).map((f) => ({ custom: f })),
      ],
    };
  }

  private shapeDeal(d: any, users: Map<number, any>) {
    return { ...d, amount: money(d.amount), owner: d.ownerId ? users.get(d.ownerId) ?? null : null, contacts: (d.contacts ?? []).map((x: any) => x.contact) };
  }
  private dealInclude = { stage: { select: { id: true, name: true, probability: true, isWon: true, isLost: true } }, company: { select: { id: true, name: true } }, contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } } } } as const;

  async listDeals(wsUid: string, userId: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    const where = this.dealWhere(ws, userId, q);
    // the board wants every deal of the pipeline (capped); the table pages
    const board = q.view === 'board';
    const { page, pageSize, skip, take } = this.paging(q);
    const [rows, total] = await Promise.all([
      this.prisma.crmDeal.findMany({ where, include: this.dealInclude, orderBy: board ? [{ position: 'asc' }, { id: 'asc' }] : this.order('deal', q), skip: board ? 0 : skip, take: board ? 2000 : take }),
      this.prisma.crmDeal.count({ where }),
    ]);
    const users = await this.users(rows.map((r) => r.ownerId));
    return { total, page, pageSize, rows: rows.map((d) => this.shapeDeal(d, users)) };
  }

  async deal(wsUid: string, userId: number, id: number) {
    const { ws } = await this.access.ws(wsUid, userId);
    const d = await this.prisma.crmDeal.findFirst({ where: { id, workspaceId: ws.id }, include: { ...this.dealInclude, pipeline: { include: { stages: { orderBy: { position: 'asc' } } } } } });
    if (!d) throw new NotFoundException('Deal not found.');
    const users = await this.users([d.ownerId, d.createdById]);
    return { ...this.shapeDeal(d, users), createdBy: users.get(d.createdById) ?? null };
  }

  async createDeal(wsUid: string, userId: number, dto: DealDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    if (!dto.name?.trim()) throw new BadRequestException('Deal name is required.');
    const pipeline = dto.pipelineId
      ? await this.prisma.crmPipeline.findFirst({ where: { id: dto.pipelineId, workspaceId: ws.id }, include: { stages: { orderBy: { position: 'asc' } } } })
      : await this.prisma.crmPipeline.findFirst({ where: { workspaceId: ws.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { stages: { orderBy: { position: 'asc' } } } });
    if (!pipeline) throw new BadRequestException('Pipeline not found.');
    const stage = dto.stageId ? pipeline.stages.find((s) => s.id === dto.stageId) : pipeline.stages.find((s) => !s.isWon && !s.isLost) ?? pipeline.stages[0];
    if (!stage) throw new BadRequestException('Stage not found in this pipeline.');
    if (stage.isLost) throw new BadRequestException('Create the deal first, then mark it lost with a reason.');
    const ownerId = dto.ownerId === undefined ? userId : dto.ownerId;
    await this.access.requireMembers(ws.id, [ownerId]);
    await this.checkLinks(ws.id, { companyId: dto.companyId, contactIds: dto.contactIds });
    const last = await this.prisma.crmDeal.findFirst({ where: { stageId: stage.id }, orderBy: { position: 'desc' }, select: { position: true } });
    const d = await this.prisma.crmDeal.create({ data: {
      workspaceId: ws.id, pipelineId: pipeline.id, stageId: stage.id, name: dto.name.trim(), amount: dto.amount ?? 0, closeDate: dto.closeDate ? new Date(dto.closeDate) : null,
      ownerId, priority: dto.priority ?? null, companyId: dto.companyId ?? null, custom: (dto.custom ?? {}) as object, createdById: userId, position: (last?.position ?? 0) + 1000,
      ...(stage.isWon && { wonAt: new Date() }),
      contacts: dto.contactIds?.length ? { create: [...new Set(dto.contactIds)].map((contactId) => ({ contactId })) } : undefined,
    } });
    await this.event(ws.id, userId, { dealId: d.id }, 'created', { stage: stage.name });
    await this.tell(ownerId, userId, 'Deal assigned to you', `“${d.name}” is now yours.`, this.href(ws.uid, 'deal', d.id));
    return this.deal(wsUid, userId, d.id);
  }

  async updateDeal(wsUid: string, userId: number, id: number, dto: DealDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const before = await this.own('crmDeal', id, ws.id);
    await this.access.requireMembers(ws.id, [dto.ownerId]);
    await this.checkLinks(ws.id, { companyId: dto.companyId, contactIds: dto.contactIds });
    if (dto.stageId !== undefined && dto.stageId !== before.stageId) await this.moveDeal(wsUid, userId, id, { stageId: dto.stageId });
    const { custom, name, contactIds, stageId: _s, pipelineId: _p, closeDate, ...rest } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.crmDeal.update({ where: { id }, data: {
        ...rest, ...(name !== undefined && { name: name.trim() }), ...(closeDate !== undefined && { closeDate: closeDate ? new Date(closeDate) : null }),
        ...(custom && { custom: { ...(before.custom as object), ...custom } as object }),
      } });
      if (contactIds) {
        await tx.crmDealContact.deleteMany({ where: { dealId: id } });
        if (contactIds.length) await tx.crmDealContact.createMany({ data: [...new Set(contactIds)].map((contactId) => ({ dealId: id, contactId })) });
      }
    });
    if (dto.ownerId !== undefined && dto.ownerId !== before.ownerId) {
      await this.event(ws.id, userId, { dealId: id }, 'owner_changed', { from: before.ownerId, to: dto.ownerId });
      await this.tell(dto.ownerId, userId, 'Deal assigned to you', `“${dto.name ?? before.name}” is now yours.`, this.href(ws.uid, 'deal', id));
    }
    if (dto.amount !== undefined && money(before.amount) !== dto.amount) await this.event(ws.id, userId, { dealId: id }, 'amount_changed', { from: money(before.amount), to: dto.amount });
    return this.deal(wsUid, userId, id);
  }

  /** drag on the board / stage picker: sets the stage and the order; Won/Lost stamps (Lost needs a reason) */
  async moveDeal(wsUid: string, userId: number, id: number, dto: MoveDealDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const d = await this.prisma.crmDeal.findFirst({ where: { id, workspaceId: ws.id }, include: { stage: true } });
    if (!d) throw new NotFoundException('Deal not found.');
    const to = await this.prisma.crmStage.findFirst({ where: { id: dto.stageId, pipeline: { workspaceId: ws.id } } });
    if (!to) throw new BadRequestException('Stage not found.');
    if (to.isLost && !d.stage.isLost && !dto.lostReason?.trim()) throw new BadRequestException('Say why the deal was lost.');
    let position: number;
    if (dto.beforeId) {
      const before = await this.prisma.crmDeal.findFirst({ where: { id: dto.beforeId, stageId: to.id }, select: { position: true } });
      const prev = before ? await this.prisma.crmDeal.findFirst({ where: { stageId: to.id, position: { lt: before.position }, NOT: { id } }, orderBy: { position: 'desc' }, select: { position: true } }) : null;
      position = before ? ((prev?.position ?? before.position - 1000) + before.position) / 2 : 1000;
    } else {
      const last = await this.prisma.crmDeal.findFirst({ where: { stageId: to.id, NOT: { id } }, orderBy: { position: 'desc' }, select: { position: true } });
      position = (last?.position ?? 0) + 1000;
    }
    const now = new Date();
    await this.prisma.crmDeal.update({ where: { id }, data: {
      stageId: to.id, pipelineId: to.pipelineId, position,
      wonAt: to.isWon ? d.wonAt ?? now : null,
      lostAt: to.isLost ? d.lostAt ?? now : null,
      lostReason: to.isLost ? dto.lostReason?.trim() || d.lostReason : null,
    } });
    if (to.id !== d.stageId) {
      await this.event(ws.id, userId, { dealId: id }, 'stage_changed', { from: d.stage.name, to: to.name, ...(to.isLost && { reason: dto.lostReason?.trim() }) });
      if ((to.isWon || to.isLost) && d.ownerId && d.ownerId !== userId) await this.tell(d.ownerId, userId, to.isWon ? 'Deal won 🎉' : 'Deal lost', `“${d.name}” moved to ${to.name}.`, this.href(ws.uid, 'deal', id));
    }
    return { ok: true, position };
  }

  async deleteRecord(wsUid: string, userId: number, obj: Obj, id: number) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const model = obj === 'contact' ? 'crmContact' : obj === 'company' ? 'crmCompany' : 'crmDeal';
    await this.own(model, id, ws.id);
    await (this.prisma[model] as any).delete({ where: { id } });
    return { ok: true };
  }

  async bulk(wsUid: string, userId: number, dto: BulkDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const ids = [...new Set(dto.ids)];
    const model = dto.object === 'contact' ? 'crmContact' : dto.object === 'company' ? 'crmCompany' : 'crmDeal';
    const where = { workspaceId: ws.id, id: { in: ids } };
    const found = await (this.prisma[model] as any).count({ where });
    if (found !== ids.length) throw new BadRequestException('Some records are not in this CRM.');
    if (dto.action === 'delete') { await (this.prisma[model] as any).deleteMany({ where }); return { ok: true, count: ids.length }; }
    if (dto.action === 'owner') {
      if (dto.ownerId === undefined) throw new BadRequestException('Pick an owner.');
      await this.access.requireMembers(ws.id, [dto.ownerId]);
      await (this.prisma[model] as any).updateMany({ where, data: { ownerId: dto.ownerId } });
      if (dto.ownerId && dto.ownerId !== userId) await this.tell(dto.ownerId, userId, `${ids.length} ${dto.object === 'company' ? 'companies' : dto.object + 's'} assigned to you`, 'Open the CRM to see them.', `/crm/${ws.uid}/${dto.object === 'company' ? 'companies' : dto.object + 's'}`);
      return { ok: true, count: ids.length };
    }
    if (dto.action === 'lifecycle') {
      if (dto.object !== 'contact' || !dto.lifecycle) throw new BadRequestException('Lifecycle applies to contacts.');
      await this.prisma.crmContact.updateMany({ where, data: { lifecycle: dto.lifecycle } });
      return { ok: true, count: ids.length };
    }
    if (dto.object !== 'deal' || !dto.stageId) throw new BadRequestException('Stage applies to deals.');
    for (const id of ids) await this.moveDeal(wsUid, userId, id, { stageId: dto.stageId, lostReason: 'Bulk update' });
    return { ok: true, count: ids.length };
  }

  /** link / unlink a contact on a deal (from either record) */
  async linkDealContact(wsUid: string, userId: number, dealId: number, contactId: number, on: boolean) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    await this.own('crmDeal', dealId, ws.id);
    await this.own('crmContact', contactId, ws.id);
    if (on) await this.prisma.crmDealContact.upsert({ where: { dealId_contactId: { dealId, contactId } }, create: { dealId, contactId }, update: {} });
    else await this.prisma.crmDealContact.deleteMany({ where: { dealId, contactId } });
    return { ok: true };
  }

  // ── activities & timeline ──
  async timeline(wsUid: string, userId: number, obj: Obj, id: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    await this.own(obj === 'contact' ? 'crmContact' : obj === 'company' ? 'crmCompany' : 'crmDeal', id, ws.id);
    let where: Prisma.CrmActivityWhereInput = obj === 'contact' ? { contactId: id } : obj === 'deal' ? { dealId: id } : { companyId: id };
    if (obj === 'company') {
      // roll up what happened with the company's people too
      const people = await this.prisma.crmContact.findMany({ where: { companyId: id }, select: { id: true }, take: 500 });
      where = { OR: [{ companyId: id }, ...(people.length ? [{ contactId: { in: people.map((p) => p.id) } }] : [])] };
    }
    const kinds = q.kind && q.kind !== 'all' ? q.kind.split(',').slice(0, 6) : undefined;
    const rows = await this.prisma.crmActivity.findMany({ where: { workspaceId: ws.id, ...where, ...(kinds && { kind: { in: kinds } }) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: Math.min(200, Number(q.take) || 100),
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } } });
    const users = await this.users(rows.flatMap((r) => [r.ownerId, r.assigneeId]));
    return rows.map((r) => ({ ...r, owner: users.get(r.ownerId) ?? null, assignee: r.assigneeId ? users.get(r.assigneeId) ?? null : null }));
  }

  private async touch(workspaceId: number, a: { contactId?: number | null; companyId?: number | null; dealId?: number | null }) {
    const now = new Date();
    await Promise.all([
      a.contactId && this.prisma.crmContact.updateMany({ where: { id: a.contactId, workspaceId }, data: { lastActivityAt: now } }),
      a.companyId && this.prisma.crmCompany.updateMany({ where: { id: a.companyId, workspaceId }, data: { lastActivityAt: now } }),
      a.dealId && this.prisma.crmDeal.updateMany({ where: { id: a.dealId, workspaceId }, data: { lastActivityAt: now } }),
    ]);
  }

  async createActivity(wsUid: string, userId: number, dto: ActivityDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    if (!dto.contactId && !dto.companyId && !dto.dealId && dto.kind !== 'task') throw new BadRequestException('Log it on a contact, company or deal.');
    if (dto.kind === 'task' && !dto.subject?.trim()) throw new BadRequestException('A task needs a title.');
    if (dto.kind !== 'task' && !dto.subject?.trim() && !dto.body?.trim()) throw new BadRequestException('Write something first.');
    await this.checkLinks(ws.id, { contactId: dto.contactId, companyId: dto.companyId, dealId: dto.dealId });
    const assigneeId = dto.kind === 'task' ? dto.assigneeId ?? userId : null;
    await this.access.requireMembers(ws.id, [assigneeId]);
    const a = await this.prisma.crmActivity.create({ data: {
      workspaceId: ws.id, kind: dto.kind, subject: dto.subject?.trim() || null, body: dto.body?.trim() || null, dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      outcome: dto.outcome ?? null, durationMin: dto.durationMin ?? null, ownerId: userId, assigneeId,
      contactId: dto.contactId ?? null, companyId: dto.companyId ?? null, dealId: dto.dealId ?? null,
    } });
    if (dto.kind !== 'task') await this.touch(ws.id, a);
    if (dto.kind === 'task') {
      const target = a.dealId ? this.href(ws.uid, 'deal', a.dealId) : a.contactId ? this.href(ws.uid, 'contact', a.contactId) : a.companyId ? this.href(ws.uid, 'company', a.companyId) : `/crm/${ws.uid}/tasks`;
      await this.tell(assigneeId, userId, 'CRM task for you', a.subject ?? 'New task', target);
    }
    return a;
  }

  async updateActivity(wsUid: string, userId: number, id: number, dto: UpdateActivityDto) {
    const { ws, canAdmin } = await this.access.ws(wsUid, userId, 'edit');
    const a = await this.prisma.crmActivity.findFirst({ where: { id, workspaceId: ws.id } });
    if (!a || a.kind === 'event') throw new NotFoundException('Activity not found.');
    const mine = a.ownerId === userId || a.assigneeId === userId;
    const onlyDone = Object.keys(dto).every((k) => k === 'done');
    if (!mine && !canAdmin && !(onlyDone && a.kind === 'task')) throw new ForbiddenException('Only its author, assignee or a CRM admin can change this.');
    await this.access.requireMembers(ws.id, [dto.assigneeId]);
    const { done, dueAt, ...rest } = dto;
    const u = await this.prisma.crmActivity.update({ where: { id }, data: {
      ...rest, ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
      ...(done !== undefined && { doneAt: done ? a.doneAt ?? new Date() : null }),
    } });
    if (done && a.kind === 'task') await this.touch(ws.id, a);
    if (dto.assigneeId && dto.assigneeId !== a.assigneeId) await this.tell(dto.assigneeId, userId, 'CRM task for you', u.subject ?? 'Task', `/crm/${ws.uid}/tasks`);
    return u;
  }

  async deleteActivity(wsUid: string, userId: number, id: number) {
    const { ws, canAdmin } = await this.access.ws(wsUid, userId, 'edit');
    const a = await this.prisma.crmActivity.findFirst({ where: { id, workspaceId: ws.id } });
    if (!a || a.kind === 'event') throw new NotFoundException('Activity not found.');
    if (a.ownerId !== userId && !canAdmin) throw new ForbiddenException('Only its author or a CRM admin can delete this.');
    await this.prisma.crmActivity.delete({ where: { id } });
    return { ok: true };
  }

  /** Tasks page: mine | all × overdue | today | upcoming | open | done */
  async tasks(wsUid: string, userId: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    const today = day0(), tomorrow = new Date(+today + 86_400_000);
    const state = q.state ?? 'open';
    const where: Prisma.CrmActivityWhereInput = {
      workspaceId: ws.id, kind: 'task',
      ...(q.scope !== 'all' && { assigneeId: q.assignee && Number(q.assignee) ? Number(q.assignee) : userId }),
      ...(state === 'done' ? { doneAt: { not: null } } : { doneAt: null }),
      ...(state === 'overdue' && { dueAt: { lt: today } }),
      ...(state === 'today' && { dueAt: { gte: today, lt: tomorrow } }),
      ...(state === 'upcoming' && { OR: [{ dueAt: { gte: tomorrow } }, { dueAt: null }] }),
    };
    const rows = await this.prisma.crmActivity.findMany({ where, orderBy: state === 'done' ? [{ doneAt: 'desc' }] : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], take: 300,
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } } });
    const base = { workspaceId: ws.id, kind: 'task', doneAt: null, ...(q.scope !== 'all' && { assigneeId: userId }) };
    const [overdue, todayN, open] = await Promise.all([
      this.prisma.crmActivity.count({ where: { ...base, dueAt: { lt: today } } }),
      this.prisma.crmActivity.count({ where: { ...base, dueAt: { gte: today, lt: tomorrow } } }),
      this.prisma.crmActivity.count({ where: base }),
    ]);
    const users = await this.users(rows.flatMap((r) => [r.ownerId, r.assigneeId]));
    return { counts: { overdue, today: todayN, open }, rows: rows.map((r) => ({ ...r, owner: users.get(r.ownerId) ?? null, assignee: r.assigneeId ? users.get(r.assigneeId) ?? null : null })) };
  }

  // ── home ──
  async home(wsUid: string, userId: number, q: Q) {
    const { ws } = await this.access.ws(wsUid, userId);
    const pipelines = await this.prisma.crmPipeline.findMany({ where: { workspaceId: ws.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { stages: { orderBy: { position: 'asc' } } } });
    const pipeline = pipelines.find((p) => p.id === Number(q.pipelineId)) ?? pipelines[0];
    const now = new Date(), today = day0(), tomorrow = new Date(+today + 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(+now - 7 * 86_400_000), ninety = new Date(+now - 90 * 86_400_000), in30 = new Date(+now + 30 * 86_400_000);
    const pid = pipeline?.id ?? -1;
    const [byStage, wonMonth, won90, lost90, newContacts, contactsTotal, myOverdue, myToday, closing, recent, owners] = await Promise.all([
      this.prisma.crmDeal.groupBy({ by: ['stageId'], where: { workspaceId: ws.id, pipelineId: pid }, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.crmDeal.aggregate({ where: { workspaceId: ws.id, wonAt: { gte: monthStart } }, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.crmDeal.count({ where: { workspaceId: ws.id, wonAt: { gte: ninety } } }),
      this.prisma.crmDeal.count({ where: { workspaceId: ws.id, lostAt: { gte: ninety } } }),
      this.prisma.crmContact.count({ where: { workspaceId: ws.id, createdAt: { gte: weekAgo } } }),
      this.prisma.crmContact.count({ where: { workspaceId: ws.id } }),
      this.prisma.crmActivity.count({ where: { workspaceId: ws.id, kind: 'task', doneAt: null, assigneeId: userId, dueAt: { lt: today } } }),
      this.prisma.crmActivity.findMany({ where: { workspaceId: ws.id, kind: 'task', doneAt: null, assigneeId: userId, dueAt: { lt: tomorrow } }, orderBy: { dueAt: 'asc' }, take: 8, include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } } }),
      this.prisma.crmDeal.findMany({ where: { workspaceId: ws.id, wonAt: null, lostAt: null, closeDate: { lte: in30 } }, orderBy: { closeDate: 'asc' }, take: 8, include: { stage: { select: { name: true, probability: true } }, company: { select: { id: true, name: true } } } }),
      this.prisma.crmActivity.findMany({ where: { workspaceId: ws.id, OR: [{ kind: { not: 'event' } }, { kind: 'event', meta: { path: ['event'], equals: 'stage_changed' } }] }, orderBy: { createdAt: 'desc' }, take: 10, include: { contact: { select: { id: true, firstName: true, lastName: true } }, deal: { select: { id: true, name: true } }, company: { select: { id: true, name: true } } } }),
      this.prisma.crmDeal.groupBy({ by: ['ownerId'], where: { workspaceId: ws.id, OR: [{ wonAt: { gte: monthStart } }, { wonAt: null, lostAt: null }] }, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    const s = new Map(byStage.map((b) => [b.stageId, b]));
    const stages = (pipeline?.stages ?? []).map((st) => {
      const b = s.get(st.id);
      const amount = money(b?._sum.amount);
      return { id: st.id, name: st.name, probability: st.probability, isWon: st.isWon, isLost: st.isLost, count: b?._count._all ?? 0, amount, weighted: Math.round(amount * st.probability) / 100 };
    });
    const open = stages.filter((x) => !x.isWon && !x.isLost);
    // leaderboard: won this month + open pipeline per owner
    const wonBy = await this.prisma.crmDeal.groupBy({ by: ['ownerId'], where: { workspaceId: ws.id, wonAt: { gte: monthStart } }, _count: { _all: true }, _sum: { amount: true } });
    const wonMap = new Map(wonBy.map((w) => [w.ownerId, w]));
    const users = await this.users([...owners.map((o) => o.ownerId), ...recent.flatMap((r) => [r.ownerId]), ...closing.map((c) => c.ownerId)]);
    const leaderboard = owners.filter((o) => o.ownerId).map((o) => {
      const w = wonMap.get(o.ownerId);
      return { user: users.get(o.ownerId!) ?? null, won: money(w?._sum.amount), wonCount: w?._count._all ?? 0, pipeline: money(o._sum.amount) - money(w?._sum.amount) };
    }).sort((a, b) => b.won - a.won || b.pipeline - a.pipeline).slice(0, 6);
    return {
      currency: ws.currency,
      pipelines: pipelines.map((p) => ({ id: p.id, name: p.name })), pipelineId: pipeline?.id ?? null,
      kpis: {
        pipelineValue: open.reduce((n, x) => n + x.amount, 0),
        weighted: Math.round(open.reduce((n, x) => n + x.weighted, 0) * 100) / 100,
        openDeals: open.reduce((n, x) => n + x.count, 0),
        wonMonth: money(wonMonth._sum.amount), wonMonthCount: wonMonth._count._all,
        winRate: won90 + lost90 ? Math.round((won90 / (won90 + lost90)) * 100) : null,
        newContacts: newContacts, contacts: contactsTotal, myOverdue,
      },
      stages,
      myTasks: myToday,
      closing: closing.map((c) => ({ ...c, amount: money(c.amount), owner: c.ownerId ? users.get(c.ownerId) ?? null : null })),
      recent: recent.map((r) => ({ ...r, owner: users.get(r.ownerId) ?? null })),
      leaderboard,
    };
  }

  /** quick search for the top bar */
  async search(wsUid: string, userId: number, term: string) {
    const { ws } = await this.access.ws(wsUid, userId);
    const s = term.trim().slice(0, 100);
    if (s.length < 2) return { contacts: [], companies: [], deals: [] };
    const ci = { contains: s, mode: 'insensitive' as const };
    const [contacts, companies, deals] = await Promise.all([
      this.prisma.crmContact.findMany({ where: { workspaceId: ws.id, OR: [{ firstName: ci }, { lastName: ci }, { email: ci }] }, take: 6, select: { id: true, firstName: true, lastName: true, email: true } }),
      this.prisma.crmCompany.findMany({ where: { workspaceId: ws.id, OR: [{ name: ci }, { domain: ci }] }, take: 6, select: { id: true, name: true, domain: true } }),
      this.prisma.crmDeal.findMany({ where: { workspaceId: ws.id, name: ci }, take: 6, select: { id: true, name: true, amount: true } }),
    ]);
    return { contacts, companies, deals: deals.map((d) => ({ ...d, amount: money(d.amount) })) };
  }

  /** for owner names in timelines */
  static displayName = nameOf;
}
