import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { STORAGE_SERVICE } from 'src/storage/storage.module';
import { StorageProvider } from 'src/storage/storage.types';
import { NotificationsService } from 'src/notifications/notifications.service';
import { MailService } from 'src/mail/mail.service';
import { NotificationType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';
import { randomBytes } from 'crypto';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const MANAGER: Role[] = ['OWNER', 'ADMIN'];
const CAN_SUBMIT: Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
const dec = (v: Prisma.Decimal) => Number(v);

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'multiselect', 'file'];
const MAPS = ['title', 'amount', 'expenseDate', 'paymentDate', 'description'];
/** the starter form (reproduces the basic claim) — admins then customise it */
const DEFAULT_FIELDS = [
  { key: 'title', label: 'Expense name', type: 'text', required: true, maps: 'title', options: undefined as any },
  { key: 'amount', label: 'Amount', type: 'number', required: true, maps: 'amount', options: undefined as any },
  { key: 'expense_date', label: 'Expense date', type: 'date', required: true, maps: 'expenseDate', options: undefined as any },
  { key: 'details', label: 'Details', type: 'textarea', required: false, maps: 'description', options: undefined as any },
  { key: 'receipt', label: 'Receipt / invoice', type: 'file', required: true, maps: null as any, options: undefined as any },
];

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /** Accept a numeric workspace id or a uid (the URL uses the uid). */
  private async resolveWs(idOrUid: string | number): Promise<number> {
    if (typeof idOrUid === 'number') return idOrUid;
    const n = parseInt(idOrUid, 10);
    if (Number.isInteger(n) && n > 0 && String(n) === idOrUid) return n;
    const ws = await this.prisma.workspace.findUnique({ where: { uid: idOrUid }, select: { id: true } });
    if (!ws) throw new NotFoundException('Workspace not found.');
    return ws.id;
  }

  /** The caller's role in an Accounts & Invoices workspace (super admin acts as OWNER). 404 if not a member. */
  private async access(workspaceId: number, userId: number): Promise<Role> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        members: {
          where: { userId, deletedAt: null },
          select: { role: true, user: { select: { systemRole: true } } },
          take: 1,
        },
      },
    });
    if (!ws) throw new NotFoundException('Workspace not found.');
    const m = ws.members[0];
    if (m?.user.systemRole === 'SUPER_ADMIN') return 'OWNER';
    if (!m) throw new NotFoundException('Workspace not found.');
    return m.role as Role;
  }

  private shape(c: any) {
    return {
      id: c.id,
      workspaceId: c.workspaceId,
      title: c.title,
      amount: dec(c.amount),
      currency: c.currency,
      categoryId: c.categoryId,
      category: c.category ? { id: c.category.id, name: c.category.name } : null,
      description: c.description,
      incurredOn: c.incurredOn,
      paidOn: c.paidOn,
      custom: c.custom ?? null,
      status: c.status,
      claimant: c.claimant ? mini(c.claimant) : null,
      manager: c.manager ? mini(c.manager) : null,
      managerAt: c.managerAt,
      finance: c.finance ? mini(c.finance) : null,
      financeAt: c.financeAt,
      paidAt: c.paidAt,
      rejectedBy: c.rejectedBy ? mini(c.rejectedBy) : null,
      rejectedReason: c.rejectedReason,
      receiptCount: c._count?.receipts ?? undefined,
      createdAt: c.createdAt,
    };
  }

  private async catMap(workspaceId: number) {
    const cats = await this.prisma.expenseCategory.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    return new Map(cats.map((c) => [c.id, c]));
  }

  private async people(ids: number[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids.filter(Boolean))] } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  // ───────── lists ─────────
  async list(wsRef: string | number, userId: number, scope: string) {
    const workspaceId = await this.resolveWs(wsRef);
    const role = await this.access(workspaceId, userId);
    const where: Prisma.ExpenseClaimWhereInput = { workspaceId };
    if (scope === 'mine') where.claimantId = userId;
    else if (scope === 'review') {
      if (!MANAGER.includes(role)) throw new ForbiddenException('Only managers review claims.');
      where.status = 'submitted';
    } else if (scope === 'pay') {
      if (!MANAGER.includes(role)) throw new ForbiddenException('Only finance can pay claims.');
      where.status = 'manager_approved';
    } else {
      // "all" — managers see everything, others see only their own
      if (!MANAGER.includes(role)) where.claimantId = userId;
    }
    const rows = await this.prisma.expenseClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { _count: { select: { receipts: true } } },
    });
    const map = await this.people(rows.flatMap((r) => [r.claimantId, r.managerId ?? 0, r.financeId ?? 0]));
    const cats = await this.catMap(workspaceId);
    return rows.map((r) =>
      this.shape({
        ...r,
        category: r.categoryId ? cats.get(r.categoryId) : null,
        claimant: map.get(r.claimantId),
        manager: r.managerId ? map.get(r.managerId) : null,
        finance: r.financeId ? map.get(r.financeId) : null,
      }),
    );
  }

  async detail(claimId: number, userId: number) {
    const c = await this.prisma.expenseClaim.findUnique({
      where: { id: claimId },
      include: {
        receipts: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Claim not found.');
    const role = await this.access(c.workspaceId, userId);
    const cats = await this.catMap(c.workspaceId);
    if (!MANAGER.includes(role) && c.claimantId !== userId)
      throw new ForbiddenException('You can only open your own claims.');
    const map = await this.people([
      c.claimantId,
      c.managerId ?? 0,
      c.financeId ?? 0,
      c.rejectedById ?? 0,
      ...c.events.map((e) => e.actorId ?? 0),
    ]);
    return {
      ...this.shape({
        ...c,
        category: c.categoryId ? cats.get(c.categoryId) : null,
        claimant: map.get(c.claimantId),
        manager: c.managerId ? map.get(c.managerId) : null,
        finance: c.financeId ? map.get(c.financeId) : null,
        rejectedBy: c.rejectedById ? map.get(c.rejectedById) : null,
      }),
      myRole: role,
      canReview: MANAGER.includes(role) && c.claimantId !== userId && c.status === 'submitted',
      canPay: MANAGER.includes(role) && c.claimantId !== userId && c.status === 'manager_approved',
      // claimant may edit while a draft, awaiting a manager, or rejected — locked once approved/paid
      canEdit: c.claimantId === userId && ['draft', 'submitted', 'rejected'].includes(c.status),
      // claimant may pull a not-yet-approved claim back to draft
      canRecall: c.claimantId === userId && ['submitted', 'rejected'].includes(c.status),
      // an admin (not the claimant) may reopen a locked (approved/paid) claim with a reason
      canReopen: MANAGER.includes(role) && c.claimantId !== userId && ['manager_approved', 'approved_paid'].includes(c.status),
      locked: ['manager_approved', 'approved_paid'].includes(c.status),
      receipts: c.receipts.map((r) => ({ id: r.id, fileUrl: r.fileUrl, fileName: r.fileName, mime: r.mime, size: r.size })),
      events: c.events.map((e) => ({ id: e.id, action: e.action, note: e.note, at: e.createdAt, actor: e.actorId ? mini(map.get(e.actorId)) : null })),
    };
  }

  // ───────── create / edit ─────────
  async create(wsRef: string | number, userId: number, dto: any) {
    const workspaceId = await this.resolveWs(wsRef);
    const role = await this.access(workspaceId, userId);
    if (!CAN_SUBMIT.includes(role)) throw new ForbiddenException('You can view claims but not submit them.');
    if (dto.categoryId) await this.category(workspaceId, dto.categoryId);
    const claim = await this.prisma.expenseClaim.create({
      data: {
        workspaceId,
        claimantId: userId,
        title: dto.title.trim(),
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'CAD',
        categoryId: dto.categoryId ?? null,
        description: dto.description?.trim() || null,
        incurredOn: dto.incurredOn ? new Date(dto.incurredOn) : null,
        paidOn: dto.paidOn ? new Date(dto.paidOn) : null,
        custom: dto.custom && typeof dto.custom === 'object' ? dto.custom : undefined,
        status: 'draft',
      },
    });
    await this.event(claim.id, userId, 'created');
    if (dto.submit) return this.submit(claim.id, userId);
    return this.detail(claim.id, userId);
  }

  async edit(claimId: number, userId: number, dto: any) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    await this.access(c.workspaceId, userId);
    if (c.claimantId !== userId) throw new ForbiddenException('This is not your claim.');
    // editable while it is a draft, awaiting a manager, or was rejected — locked once approved or paid
    if (!['draft', 'submitted', 'rejected'].includes(c.status)) throw new ForbiddenException('This claim is approved or paid and can no longer be edited. Ask an admin to reopen it.');
    if (dto.categoryId) await this.category(c.workspaceId, dto.categoryId);
    const changed: string[] = [];
    const data: any = {};
    if (dto.title !== undefined && dto.title.trim() !== c.title) { data.title = dto.title.trim(); changed.push('name'); }
    if (dto.amount !== undefined && Number(dto.amount) !== Number(c.amount)) { data.amount = new Prisma.Decimal(dto.amount); changed.push('amount'); }
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.categoryId !== undefined && dto.categoryId !== c.categoryId) { data.categoryId = dto.categoryId; changed.push('category'); }
    if (dto.description !== undefined) { data.description = dto.description?.trim() || null; changed.push('details'); }
    if (dto.incurredOn !== undefined) { data.incurredOn = dto.incurredOn ? new Date(dto.incurredOn) : null; changed.push('expense date'); }
    if (dto.paidOn !== undefined) { data.paidOn = dto.paidOn ? new Date(dto.paidOn) : null; changed.push('payment date'); }
    if (dto.custom !== undefined && typeof dto.custom === 'object') { data.custom = dto.custom; changed.push('fields'); }
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data });
    await this.event(claimId, userId, 'edited', changed.length ? `changed ${changed.join(', ')}${c.status !== 'draft' ? ` (while ${c.status})` : ''}` : undefined);
    return this.detail(claimId, userId);
  }

  async submit(claimId: number, userId: number) {
    const c = await this.owned(claimId, userId, 'draft', 'This claim is already submitted.');
    if (!(await this.prisma.expenseReceipt.count({ where: { claimId } })))
      throw new BadRequestException('Attach at least one receipt before submitting.');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'submitted' } });
    await this.event(claimId, userId, 'submitted');
    await this.afterSubmit(claimId, c.workspaceId, userId, c.title);
    return this.detail(claimId, userId);
  }

  async approve(claimId: number, userId: number) {
    const c = await this.stepGuard(claimId, userId, 'submitted');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'manager_approved', managerId: userId, managerAt: new Date() } });
    await this.event(claimId, userId, 'manager_approved');
    await this.notifyManagers(c.workspaceId, userId, `${c.title} ready to pay`, `A reimbursement is approved and waiting for finance.`, claimId, 'manager_approved');
    await this.tellClaimant(c.claimantId, userId, `Your claim "${c.title}" was approved`, 'A manager approved it; finance will pay it next.', claimId);
    return this.detail(claimId, userId);
  }

  async pay(claimId: number, userId: number) {
    const c = await this.stepGuard(claimId, userId, 'manager_approved');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'approved_paid', financeId: userId, financeAt: new Date(), paidAt: new Date() } });
    await this.event(claimId, userId, 'finance_paid');
    await this.tellClaimant(c.claimantId, userId, `Your claim "${c.title}" was paid`, 'Finance marked your reimbursement as paid.', claimId);
    return this.detail(claimId, userId);
  }

  async reject(claimId: number, userId: number, reason?: string) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    const role = await this.access(c.workspaceId, userId);
    if (!MANAGER.includes(role)) throw new ForbiddenException('Only a manager or finance can reject a claim.');
    if (c.claimantId === userId) throw new ForbiddenException('You cannot act on your own claim (separation of duties).');
    if (!['submitted', 'manager_approved'].includes(c.status)) throw new BadRequestException('This claim cannot be rejected now.');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'rejected', rejectedById: userId, rejectedReason: reason?.trim() || null } });
    await this.event(claimId, userId, 'rejected', reason?.trim() || undefined);
    await this.tellClaimant(c.claimantId, userId, `Your claim "${c.title}" was declined`, reason?.trim() ? `Reason: ${reason.trim()}` : 'No reason was given.', claimId);
    return this.detail(claimId, userId);
  }

  async remove(claimId: number, userId: number) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId }, include: { receipts: true } });
    if (!c) throw new NotFoundException('Claim not found.');
    const role = await this.access(c.workspaceId, userId);
    const isOwnerDraft = c.claimantId === userId && c.status === 'draft';
    if (!isOwnerDraft && !MANAGER.includes(role)) throw new ForbiddenException('You can only delete your own draft.');
    for (const r of c.receipts) await this.storage.delete(r.storageKey).catch(() => null);
    await this.prisma.expenseClaim.delete({ where: { id: claimId } });
    return { deleted: true };
  }

  // ───────── receipts ─────────
  async addReceipt(claimId: number, userId: number, file: Express.Multer.File) {
    const c = await this.owned(claimId, userId, 'draft', 'Receipts can only be added before submitting.');
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!/^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i.test(file.mimetype))
      throw new BadRequestException('Only images or PDF receipts are allowed.');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('Receipts must be 10MB or smaller.');
    if ((await this.prisma.expenseReceipt.count({ where: { claimId } })) >= 10)
      throw new BadRequestException('Up to 10 receipts per claim.');
    const up = await this.storage.upload(file, 'expense-receipts');
    const r = await this.prisma.expenseReceipt.create({
      data: { claimId, storageKey: up.storageKey, fileUrl: this.storage.getUrl(up.storageKey), fileName: up.fileName, mime: up.mimeType, size: up.fileSize, uploadedById: userId },
    });
    return { id: r.id, fileUrl: r.fileUrl, fileName: r.fileName, mime: r.mime, size: r.size };
  }

  async removeReceipt(receiptId: number, userId: number) {
    const r = await this.prisma.expenseReceipt.findUnique({ where: { id: receiptId }, include: { claim: true } });
    if (!r) throw new NotFoundException('Receipt not found.');
    if (r.claim.claimantId !== userId || r.claim.status !== 'draft')
      throw new ForbiddenException('Receipts can only be removed from your own draft.');
    await this.storage.delete(r.storageKey).catch(() => null);
    await this.prisma.expenseReceipt.delete({ where: { id: receiptId } });
    return { deleted: true };
  }

  // ───────── categories ─────────
  async categories(wsRef: string | number, userId: number) {
    const workspaceId = await this.resolveWs(wsRef);
    await this.access(workspaceId, userId);
    const cats = await this.prisma.expenseCategory.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
    // spent this month per category
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const spent = await this.prisma.expenseClaim.groupBy({
      by: ['categoryId'],
      where: { workspaceId, status: 'approved_paid', paidAt: { gte: start } },
      _sum: { amount: true },
    });
    const bySpent = new Map(spent.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]));
    return cats.map((c) => ({ id: c.id, name: c.name, monthlyBudget: c.monthlyBudget ? dec(c.monthlyBudget) : null, active: c.active, spentThisMonth: bySpent.get(c.id) ?? 0 }));
  }

  async createCategory(wsRef: string | number, userId: number, dto: any) {
    const workspaceId = await this.resolveWs(wsRef);
    await this.requireManager(workspaceId, userId);
    const c = await this.prisma.expenseCategory.create({ data: { workspaceId, name: dto.name.trim(), monthlyBudget: dto.monthlyBudget != null ? new Prisma.Decimal(dto.monthlyBudget) : null, active: dto.active ?? true } });
    return { id: c.id };
  }

  async updateCategory(categoryId: number, userId: number, dto: any) {
    const cat = await this.prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Category not found.');
    await this.requireManager(cat.workspaceId, userId);
    await this.prisma.expenseCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.monthlyBudget !== undefined && { monthlyBudget: dto.monthlyBudget != null ? new Prisma.Decimal(dto.monthlyBudget) : null }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
    return { updated: true };
  }

  async deleteCategory(categoryId: number, userId: number) {
    const cat = await this.prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!cat) throw new NotFoundException('Category not found.');
    await this.requireManager(cat.workspaceId, userId);
    await this.prisma.expenseClaim.updateMany({ where: { categoryId }, data: { categoryId: null } });
    await this.prisma.expenseCategory.delete({ where: { id: categoryId } });
    return { deleted: true };
  }

  // ───────── summary ─────────
  async summary(wsRef: string | number, userId: number) {
    const workspaceId = await this.resolveWs(wsRef);
    const role = await this.access(workspaceId, userId);
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [paidThisMonth, pending, mine] = await Promise.all([
      this.prisma.expenseClaim.aggregate({ where: { workspaceId, status: 'approved_paid', paidAt: { gte: start } }, _sum: { amount: true } }),
      this.prisma.expenseClaim.count({ where: { workspaceId, status: { in: ['submitted', 'manager_approved'] } } }),
      this.prisma.expenseClaim.count({ where: { workspaceId, claimantId: userId, status: { notIn: ['approved_paid', 'rejected'] } } }),
    ]);
    const cats = await this.categories(workspaceId, userId);
    return {
      myRole: role,
      isManager: MANAGER.includes(role),
      canSubmit: CAN_SUBMIT.includes(role),
      paidThisMonth: Number(paidThisMonth._sum.amount ?? 0),
      pending,
      myOpen: mine,
      toReview: MANAGER.includes(role) ? await this.prisma.expenseClaim.count({ where: { workspaceId, status: 'submitted' } }) : 0,
      toPay: MANAGER.includes(role) ? await this.prisma.expenseClaim.count({ where: { workspaceId, status: 'manager_approved' } }) : 0,
      categories: cats.map((c) => ({ ...c, overBudget: c.monthlyBudget != null && c.spentThisMonth > c.monthlyBudget })),
    };
  }

  /** Total PAID expenses per workspace in a period — used by the Executive Hub report. Caller must be a member of each. */
  async consumption(userId: number, workspaceIds: number[], from?: string, to?: string) {
    const ids: number[] = [];
    for (const id of workspaceIds) {
      try { await this.access(id, userId); ids.push(id); } catch { /* skip ones they can't see */ }
    }
    if (!ids.length) return {};
    const where: Prisma.ExpenseClaimWhereInput = { workspaceId: { in: ids }, status: 'approved_paid' };
    if (from || to) where.paidAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
    const rows = await this.prisma.expenseClaim.groupBy({ by: ['workspaceId'], where, _sum: { amount: true }, _count: true });
    const out: Record<number, { total: number; count: number }> = {};
    for (const r of rows) out[r.workspaceId] = { total: Number(r._sum.amount ?? 0), count: r._count };
    return out;
  }

  // ───────── helpers ─────────
  // ───────── reimbursement form (branding + custom fields + share link) ─────────

  /** the form for a company, creating a default one on first use */
  private async ensureForm(workspaceId: number) {
    const existing = await this.prisma.expenseForm.findUnique({ where: { workspaceId }, include: { fields: { orderBy: { order: 'asc' } } } });
    if (existing) return existing;
    return this.prisma.expenseForm.create({
      data: {
        workspaceId,
        shareToken: randomBytes(18).toString('base64url'),
        fields: { create: DEFAULT_FIELDS.map((f, i) => ({ ...f, order: i })) },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
  }

  private shapeForm(f: any, wsName?: string) {
    return {
      id: f.id, workspaceId: f.workspaceId, title: f.title, description: f.description,
      logoUrl: f.logoUrl, bannerUrl: f.bannerUrl, shareToken: f.shareToken, active: f.active,
      company: wsName, fields: (f.fields ?? []).map((x: any) => ({ id: x.id, key: x.key, label: x.label, type: x.type, options: x.options ?? null, required: x.required, maps: x.maps ?? null })),
    };
  }

  async getForm(wsRef: string | number, userId: number) {
    const workspaceId = await this.resolveWs(wsRef);
    await this.access(workspaceId, userId);
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    return this.shapeForm(await this.ensureForm(workspaceId), ws?.name);
  }

  /** admins edit the form: branding + the whole field list (replaced) */
  async updateForm(wsRef: string | number, userId: number, dto: any) {
    const workspaceId = await this.resolveWs(wsRef);
    await this.requireManager(workspaceId, userId);
    const form = await this.ensureForm(workspaceId);
    const fields: any[] = Array.isArray(dto.fields) ? dto.fields : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.expenseForm.update({
        where: { id: form.id },
        data: {
          ...(dto.title !== undefined && { title: String(dto.title).trim().slice(0, 160) || 'Reimbursements' }),
          ...(dto.description !== undefined && { description: dto.description ? String(dto.description).trim().slice(0, 1000) : null }),
          ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl || null }),
          ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl || null }),
          ...(dto.active !== undefined && { active: !!dto.active }),
          updatedById: userId,
        },
      });
      if (fields) {
        await tx.expenseFormField.deleteMany({ where: { formId: form.id } });
        const seen = new Set<string>();
        const clean = fields.filter((f) => f && typeof f.label === 'string').slice(0, 40).map((f, i) => {
          let key = String(f.key || f.label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `f${i}`;
          while (seen.has(key)) key = `${key}_${i}`;
          seen.add(key);
          const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
          const maps = MAPS.includes(f.maps) ? f.maps : null;
          return { formId: form.id, key, label: String(f.label).trim().slice(0, 120), type, required: !!f.required, order: i, maps, options: (type === 'select' || type === 'multiselect') && Array.isArray(f.options) ? f.options.map((o: any) => String(o).slice(0, 120)).slice(0, 50) : undefined };
        });
        if (clean.length) await tx.expenseFormField.createMany({ data: clean as any });
      }
    });
    return this.getForm(workspaceId, userId);
  }

  async uploadBranding(wsRef: string | number, userId: number, kind: string, file: Express.Multer.File) {
    const workspaceId = await this.resolveWs(wsRef);
    await this.requireManager(workspaceId, userId);
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype)) throw new BadRequestException('Logo/banner must be an image.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Image must be 5MB or smaller.');
    const up = await this.storage.upload(file, 'expense-forms');
    const url = this.storage.getUrl(up.storageKey);
    const form = await this.ensureForm(workspaceId);
    await this.prisma.expenseForm.update({ where: { id: form.id }, data: kind === 'banner' ? { bannerUrl: url } : { logoUrl: url }, });
    return { url };
  }

  /** the shared form by token (anyone may view; only a logged-in user may submit) */
  async formByToken(token: string) {
    const f = await this.prisma.expenseForm.findUnique({ where: { shareToken: token }, include: { fields: { orderBy: { order: 'asc' } } } });
    if (!f || !f.active) throw new NotFoundException('This reimbursement form is not open.');
    const ws = await this.prisma.workspace.findUnique({ where: { id: f.workspaceId }, select: { name: true } });
    return this.shapeForm(f, ws?.name);
  }

  /** submit a claim through the shared form — logged in required (the controller enforces the session) */
  async submitViaForm(token: string, userId: number, values: Record<string, unknown>, files: Express.Multer.File[]) {
    const f = await this.prisma.expenseForm.findUnique({ where: { shareToken: token }, include: { fields: { orderBy: { order: 'asc' } } } });
    if (!f || !f.active) throw new NotFoundException('This reimbursement form is not open.');
    const built = this.buildFromFields(f.fields, values);
    const claim = await this.prisma.expenseClaim.create({
      data: { workspaceId: f.workspaceId, claimantId: userId, title: built.title, amount: new Prisma.Decimal(built.amount), description: built.description, incurredOn: built.incurredOn, paidOn: built.paidOn, custom: built.custom as Prisma.InputJsonValue, status: 'submitted' },
    });
    await this.event(claim.id, userId, 'created');
    for (const file of (files ?? []).slice(0, 10)) await this.storeReceipt(claim.id, userId, file).catch(() => null);
    await this.event(claim.id, userId, 'submitted');
    await this.afterSubmit(claim.id, f.workspaceId, userId, built.title);
    return { ok: true, claimId: claim.id };
  }

  /** turn form field values into a claim (title + amount required; mapped fields → columns; rest → custom) */
  private buildFromFields(fields: any[], values: Record<string, unknown>) {
    const custom: Record<string, unknown> = {};
    let title = '', amount = NaN, description: string | null = null, incurredOn: Date | null = null, paidOn: Date | null = null;
    for (const f of fields) {
      if (f.type === 'file') continue;
      const raw = values[f.key];
      const v = Array.isArray(raw) ? raw.map((x) => String(x)) : raw == null ? '' : String(raw).trim();
      const empty = Array.isArray(v) ? v.length === 0 : v === '';
      if (f.required && empty) throw new BadRequestException(`"${f.label}" is required.`);
      if (empty) continue;
      if (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v as string)) throw new BadRequestException(`"${f.label}" must be an email.`);
      if (f.type === 'number' && !Number.isFinite(Number(v))) throw new BadRequestException(`"${f.label}" must be a number.`);
      if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}/.test(v as string)) throw new BadRequestException(`"${f.label}" must be a date.`);
      if (f.type === 'select' && f.options && !f.options.includes(v)) throw new BadRequestException(`Pick one of the choices for "${f.label}".`);
      switch (f.maps) {
        case 'title': title = String(v).slice(0, 160); break;
        case 'amount': amount = Number(v); break;
        case 'description': description = String(v).slice(0, 2000); break;
        case 'expenseDate': incurredOn = new Date(v as string); break;
        case 'paymentDate': paidOn = new Date(v as string); break;
        default: custom[f.key] = v;
      }
    }
    if (!title) title = String(custom['expense_name'] ?? custom['name'] ?? 'Reimbursement').slice(0, 160);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('A valid amount is required.');
    return { title, amount, description, incurredOn, paidOn, custom: Object.keys(custom).length ? custom : undefined };
  }

  private async storeReceipt(claimId: number, userId: number, file: Express.Multer.File) {
    if (!file) return;
    if (!/^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/i.test(file.mimetype)) return;
    if (file.size > 10 * 1024 * 1024) return;
    const up = await this.storage.upload(file, 'expense-receipts');
    await this.prisma.expenseReceipt.create({ data: { claimId, storageKey: up.storageKey, fileUrl: this.storage.getUrl(up.storageKey), fileName: up.fileName, mime: up.mimeType, size: up.fileSize, uploadedById: userId } });
  }

  // ───────── recall / reopen (editability) ─────────

  /** claimant pulls a not-yet-approved claim back to draft to edit it */
  async recall(claimId: number, userId: number) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    await this.access(c.workspaceId, userId);
    if (c.claimantId !== userId) throw new ForbiddenException('This is not your claim.');
    if (!['submitted', 'rejected'].includes(c.status)) throw new BadRequestException('Only a claim that is not yet approved can be recalled.');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'draft', rejectedById: null, rejectedReason: null } });
    await this.event(claimId, userId, 'edited', 'recalled to draft');
    return this.detail(claimId, userId);
  }

  /** an admin (not the claimant) reopens a locked (approved/paid) claim with a reason */
  async reopen(claimId: number, userId: number, reason?: string) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    const role = await this.access(c.workspaceId, userId);
    if (!MANAGER.includes(role)) throw new ForbiddenException('Only an admin can reopen a claim.');
    if (c.claimantId === userId) throw new ForbiddenException('You cannot reopen your own claim (separation of duties).');
    if (!['manager_approved', 'approved_paid'].includes(c.status)) throw new BadRequestException('Only an approved or paid claim can be reopened.');
    if (!reason?.trim()) throw new BadRequestException('A reason is required to reopen a claim.');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'submitted', managerId: null, managerAt: null, financeId: null, financeAt: null, paidAt: null } });
    await this.event(claimId, userId, 'edited', `reopened: ${reason.trim().slice(0, 400)}`);
    await this.tellClaimant(c.claimantId, userId, `Your claim "${c.title}" was reopened`, `An admin reopened it for review. Reason: ${reason.trim()}`, claimId);
    await this.notifyManagers(c.workspaceId, userId, `${c.title} reopened`, 'A paid/approved claim was reopened for review.', claimId, 'reopened');
    return this.detail(claimId, userId);
  }

  // ───────── email helpers ─────────

  private async afterSubmit(claimId: number, workspaceId: number, actorId: number, title: string) {
    // in-app to managers (existing) + email to owner, admins and the form's creator/updater
    await this.notifyManagers(workspaceId, actorId, `${title} needs review`, 'A reimbursement claim is waiting for a manager.', claimId, 'submitted');
    const form = await this.prisma.expenseForm.findUnique({ where: { workspaceId }, select: { updatedById: true } });
    const managers = await this.prisma.workspaceMember.findMany({ where: { workspaceId, role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null }, select: { userId: true } });
    const ids = new Set<number>(managers.map((m) => m.userId));
    if (form?.updatedById) ids.add(form.updatedById);
    ids.delete(actorId);
    await this.emailUsers([...ids], `New reimbursement: ${title}`, `A new reimbursement claim "${title}" was submitted and is waiting for review.`, claimId, workspaceId);
  }

  private async emailUsers(userIds: number[], subject: string, body: string, claimId: number, workspaceId: number) {
    if (!userIds.length) return;
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { uid: true } });
    const link = `${process.env.FRONTEND_URL ?? ''}/workspace/${ws?.uid ?? workspaceId}/expenses`;
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true, firstName: true } });
    for (const u of users) {
      if (!u.email) continue;
      await this.mail.sendMail({
        to: u.email,
        subject,
        html: `<p>Hi ${u.firstName ?? ''},</p><p>${body}</p><p><a href="${link}">Open Reimbursements</a></p>`,
        text: `${body}\n\nOpen Reimbursements: ${link}`,
      }).catch(() => null);
    }
  }

  private async owned(claimId: number, userId: number, status: string, msg: string) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    await this.access(c.workspaceId, userId);
    if (c.claimantId !== userId) throw new ForbiddenException('This is not your claim.');
    if (c.status !== status) throw new BadRequestException(msg);
    return c;
  }

  private async stepGuard(claimId: number, userId: number, status: string) {
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId } });
    if (!c) throw new NotFoundException('Claim not found.');
    const role = await this.access(c.workspaceId, userId);
    if (!MANAGER.includes(role)) throw new ForbiddenException('Only a manager or finance can do this.');
    if (c.claimantId === userId) throw new ForbiddenException('You cannot approve or pay your own claim (separation of duties).');
    if (c.status !== status) throw new BadRequestException('This claim is not at the right step.');
    return c;
  }

  private async requireManager(workspaceId: number, userId: number) {
    const role = await this.access(workspaceId, userId);
    if (!MANAGER.includes(role)) throw new ForbiddenException('Only an admin can manage categories.');
    return role;
  }

  private async category(workspaceId: number, categoryId: number) {
    const cat = await this.prisma.expenseCategory.findFirst({ where: { id: categoryId, workspaceId } });
    if (!cat) throw new BadRequestException('That category is not in this company.');
    return cat;
  }

  private event(claimId: number, actorId: number, action: string, note?: string) {
    return this.prisma.expenseEvent.create({ data: { claimId, actorId, action, note: note ?? null } });
  }

  private async notifyManagers(workspaceId: number, actorId: number, title: string, message: string, claimId: number, kind: string) {
    const managers = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null, userId: { not: actorId } },
      select: { userId: true },
    });
    for (const m of managers)
      await this.notifications
        .notify({ recipientId: m.userId, type: NotificationType.AUTOMATION, title, message, entityType: 'WORKSPACE', entityId: workspaceId, metadata: { claimId, kind }, product: 'boards' })
        .catch(() => null);
  }

  private async tellClaimant(claimantId: number, actorId: number, title: string, message: string, claimId: number) {
    if (claimantId === actorId) return;
    await this.notifications
      .notify({ recipientId: claimantId, type: NotificationType.AUTOMATION, title, message, entityType: 'WORKSPACE', metadata: { claimId }, product: 'boards' })
      .catch(() => null);
    const c = await this.prisma.expenseClaim.findUnique({ where: { id: claimId }, select: { workspaceId: true } });
    if (c) await this.emailUsers([claimantId], title, message, claimId, c.workspaceId);
  }
}

const mini = (u: any) => (u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl ?? null } : null);
