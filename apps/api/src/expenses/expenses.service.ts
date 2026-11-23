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
import { NotificationType } from 'generated/prisma/enums';
import { Prisma } from 'generated/prisma/client';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST';
const MANAGER: Role[] = ['OWNER', 'ADMIN'];
const CAN_SUBMIT: Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
const dec = (v: Prisma.Decimal) => Number(v);

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageProvider,
    private readonly notifications: NotificationsService,
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
      canEdit: c.claimantId === userId && c.status === 'draft',
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
        status: 'draft',
      },
    });
    await this.event(claim.id, userId, 'created');
    if (dto.submit) return this.submit(claim.id, userId);
    return this.detail(claim.id, userId);
  }

  async edit(claimId: number, userId: number, dto: any) {
    const c = await this.owned(claimId, userId, 'draft', 'Only a draft can be edited.');
    if (dto.categoryId) await this.category(c.workspaceId, dto.categoryId);
    await this.prisma.expenseClaim.update({
      where: { id: claimId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.amount !== undefined && { amount: new Prisma.Decimal(dto.amount) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.incurredOn !== undefined && { incurredOn: dto.incurredOn ? new Date(dto.incurredOn) : null }),
      },
    });
    await this.event(claimId, userId, 'edited');
    return this.detail(claimId, userId);
  }

  async submit(claimId: number, userId: number) {
    const c = await this.owned(claimId, userId, 'draft', 'This claim is already submitted.');
    if (!(await this.prisma.expenseReceipt.count({ where: { claimId } })))
      throw new BadRequestException('Attach at least one receipt before submitting.');
    await this.prisma.expenseClaim.update({ where: { id: claimId }, data: { status: 'submitted' } });
    await this.event(claimId, userId, 'submitted');
    await this.notifyManagers(c.workspaceId, userId, `${c.title} needs review`, `A reimbursement claim is waiting for a manager.`, claimId, 'submitted');
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
  }
}

const mini = (u: any) => (u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl ?? null } : null);
