import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { CrmAccessService } from './crm-access.service';
import type { AddCrmMemberDto, CreateCrmWorkspaceDto, PipelineDto, PropertyDto, UpdateCrmMemberDto, UpdateCrmWorkspaceDto, UpdatePropertyDto, UpdateViewDto, ViewDto } from './dto/crm.dto';

const uid = () => randomBytes(9).toString('base64url').substring(0, 12);
const USER = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } as const;
export const DEFAULT_STAGES = [
  { name: 'New', probability: 10 },
  { name: 'Qualified', probability: 20 },
  { name: 'Meeting booked', probability: 40 },
  { name: 'Proposal', probability: 60 },
  { name: 'Negotiation', probability: 80 },
  { name: 'Won', probability: 100, isWon: true },
  { name: 'Lost', probability: 0, isLost: true },
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';

/** EZ Sales setup: workspaces, members, pipelines & stages, custom properties, saved views, notifications. */
@Injectable()
export class CrmSetupService {
  constructor(private readonly prisma: PrismaService, private readonly access: CrmAccessService, @Optional() private readonly mail?: MailService) {}

  private esc(t: string) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** pending invites into a CRM (people who haven't signed up yet) */
  private async pendingInvites(workspaceId: number) {
    const rows = await this.prisma.crmInvitation.findMany({ where: { workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, createdAt: true } });
    return rows;
  }

  // ── workspaces ──
  async myWorkspaces(userId: number) {
    const admin = await this.access.isCrmAdministrator(userId);
    // a CRM Administrator (global or product-level) opens every CRM workspace, even without a membership
    const rows = admin
      ? (await this.prisma.crmWorkspace.findMany({ select: { id: true, uid: true, name: true, currency: true, createdAt: true }, orderBy: { createdAt: 'asc' } })).map((workspace) => ({ workspaceId: workspace.id, role: 'ADMIN', workspace }))
      : await this.prisma.crmMember.findMany({ where: { userId }, include: { workspace: { select: { id: true, uid: true, name: true, currency: true, createdAt: true } } }, orderBy: { joinedAt: 'asc' } });
    const ids = rows.map((r) => r.workspaceId);
    const [contacts, deals] = await Promise.all([
      this.prisma.crmContact.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: ids } }, _count: { _all: true } }),
      this.prisma.crmDeal.groupBy({ by: ['workspaceId'], where: { workspaceId: { in: ids }, wonAt: null, lostAt: null }, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    const c = new Map(contacts.map((x) => [x.workspaceId, x._count._all]));
    const d = new Map(deals.map((x) => [x.workspaceId, { open: x._count._all, value: Number(x._sum.amount ?? 0) }]));
    return {
      canCreate: await this.access.isCrmAdministrator(userId),
      workspaces: rows.map((r) => ({ ...r.workspace, role: r.role, contacts: c.get(r.workspaceId) ?? 0, openDeals: d.get(r.workspaceId)?.open ?? 0, pipelineValue: d.get(r.workspaceId)?.value ?? 0 })),
    };
  }

  async createWorkspace(userId: number, dto: CreateCrmWorkspaceDto) {
    if (!(await this.access.isSuperAdmin(userId))) throw new ForbiddenException('Only Administrators can start a new CRM.');
    const ws = await this.prisma.crmWorkspace.create({
      data: {
        uid: uid(), name: dto.name.trim(), ownerId: userId, currency: (dto.currency ?? 'USD').toUpperCase(),
        members: { create: { userId, role: 'OWNER' } },
        pipelines: { create: { name: 'Sales pipeline', stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })) } } },
      },
    });
    return { uid: ws.uid, name: ws.name };
  }

  async workspace(wsUid: string, userId: number) {
    const { ws, role, canEdit, canAdmin } = await this.access.ws(wsUid, userId);
    const [members, pipelines, properties, invites] = await Promise.all([
      this.members(ws.id),
      this.pipelines(ws.id),
      this.prisma.crmProperty.findMany({ where: { workspaceId: ws.id }, orderBy: [{ object: 'asc' }, { position: 'asc' }, { id: 'asc' }] }),
      canAdmin ? this.pendingInvites(ws.id) : Promise.resolve([] as { id: number; email: string; role: string; createdAt: Date }[]),
    ]);
    return { ...ws, role, canEdit, canAdmin, members, pipelines, properties, invites };
  }

  async updateWorkspace(wsUid: string, userId: number, dto: UpdateCrmWorkspaceDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    await this.prisma.crmWorkspace.update({ where: { id: ws.id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.currency && { currency: dto.currency.toUpperCase() }) } });
    return { ok: true };
  }

  async deleteWorkspace(wsUid: string, userId: number) {
    const { ws, role } = await this.access.ws(wsUid, userId, 'admin');
    if (role !== 'OWNER') throw new ForbiddenException('Only the owner can delete this CRM.');
    await this.prisma.crmWorkspace.delete({ where: { id: ws.id } });
    return { ok: true };
  }

  // ── members ──
  private async members(workspaceId: number) {
    const rows = await this.prisma.crmMember.findMany({ where: { workspaceId }, include: { user: { select: USER } }, orderBy: { joinedAt: 'asc' } });
    return rows.map((r) => ({ role: r.role, joinedAt: r.joinedAt, user: r.user }));
  }

  async addMember(wsUid: string, userId: number, dto: AddCrmMemberDto) {
    const { ws, role } = await this.access.ws(wsUid, userId, 'admin');
    if (dto.role === 'OWNER' && role !== 'OWNER') throw new ForbiddenException('Only the owner can add another owner.');
    const email = dto.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email.');
    const u = await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null }, select: { id: true } });
    // already has an EZ Manage account → add straight away
    if (u) {
      const had = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: u.id } } });
      if (had) throw new BadRequestException('Already a member of this CRM.');
      await this.prisma.crmMember.create({ data: { workspaceId: ws.id, userId: u.id, role: dto.role } });
      return { invited: false as const };
    }
    // new person → invite them by email; they become a member when they sign up
    const open = await this.prisma.crmInvitation.findFirst({ where: { workspaceId: ws.id, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } });
    if (open) throw new BadRequestException('Already invited — they just need to sign up.');
    const token = randomBytes(24).toString('base64url');
    await this.prisma.crmInvitation.create({ data: { workspaceId: ws.id, email, role: dto.role, token, invitedById: userId, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    const link = `${process.env.FRONTEND_URL ?? ''}/setup-account?token=${token}`;
    const inviter = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const who = `${inviter?.firstName ?? ''} ${inviter?.lastName ?? ''}`.trim() || 'Your team';
    try {
      await this.mail?.sendMail({
        to: email,
        subject: `${who} invited you to a CRM on EZ Manage`,
        html: `<p>${this.esc(who)} invited you to the <b>${this.esc(ws.name)}</b> CRM on EZ Manage as ${this.esc(dto.role)}.</p><p><a href="${link}">Set up your account</a> to join. The link expires in 7 days.</p>`,
        text: `${who} invited you to the ${ws.name} CRM on EZ Manage as ${dto.role}.\n\nSet up your account: ${link} (expires in 7 days)`,
      });
    } catch { /* email failures shouldn't block the invite */ }
    return { invited: true as const, email };
  }

  async cancelInvite(wsUid: string, userId: number, inviteId: number) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    await this.prisma.crmInvitation.deleteMany({ where: { id: inviteId, workspaceId: ws.id } });
    return { ok: true };
  }

  async updateMember(wsUid: string, userId: number, memberId: number, dto: UpdateCrmMemberDto) {
    const { ws, role } = await this.access.ws(wsUid, userId, 'admin');
    const m = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: memberId } } });
    if (!m) throw new NotFoundException('Member not found.');
    if ((m.role === 'OWNER' || dto.role === 'OWNER') && role !== 'OWNER') throw new ForbiddenException('Only the owner can change owners.');
    if (m.role === 'OWNER' && dto.role !== 'OWNER') {
      const owners = await this.prisma.crmMember.count({ where: { workspaceId: ws.id, role: 'OWNER' } });
      if (owners <= 1) throw new BadRequestException('A CRM needs at least one owner.');
    }
    await this.prisma.crmMember.update({ where: { workspaceId_userId: { workspaceId: ws.id, userId: memberId } }, data: { role: dto.role } });
    return this.members(ws.id);
  }

  async removeMember(wsUid: string, userId: number, memberId: number) {
    const { ws, role } = await this.access.ws(wsUid, userId, memberId === userId ? 'view' : 'admin');
    const m = await this.prisma.crmMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: memberId } } });
    if (!m) throw new NotFoundException('Member not found.');
    if (m.role === 'OWNER') {
      if (role !== 'OWNER' && memberId !== userId) throw new ForbiddenException('Only the owner can remove an owner.');
      const owners = await this.prisma.crmMember.count({ where: { workspaceId: ws.id, role: 'OWNER' } });
      if (owners <= 1) throw new BadRequestException('A CRM needs at least one owner.');
    }
    await this.prisma.crmMember.delete({ where: { workspaceId_userId: { workspaceId: ws.id, userId: memberId } } });
    // their records stay; they just lose the owner
    await Promise.all([
      this.prisma.crmContact.updateMany({ where: { workspaceId: ws.id, ownerId: memberId }, data: { ownerId: null } }),
      this.prisma.crmCompany.updateMany({ where: { workspaceId: ws.id, ownerId: memberId }, data: { ownerId: null } }),
      this.prisma.crmDeal.updateMany({ where: { workspaceId: ws.id, ownerId: memberId }, data: { ownerId: null } }),
    ]);
    return this.members(ws.id);
  }

  // ── pipelines ──
  async pipelines(workspaceId: number) {
    return this.prisma.crmPipeline.findMany({ where: { workspaceId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { stages: { orderBy: { position: 'asc' } } } });
  }

  async createPipeline(wsUid: string, userId: number, dto: PipelineDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    const stages = dto.stages?.length ? dto.stages : DEFAULT_STAGES;
    this.checkStages(stages);
    const n = await this.prisma.crmPipeline.count({ where: { workspaceId: ws.id } });
    if (n >= 20) throw new BadRequestException('Up to 20 pipelines.');
    await this.prisma.crmPipeline.create({ data: { workspaceId: ws.id, name: dto.name.trim(), position: n, stages: { create: stages.map((s, i) => ({ name: s.name.trim(), probability: s.probability, isWon: !!s.isWon, isLost: !!s.isLost, position: i })) } } });
    return this.pipelines(ws.id);
  }

  private checkStages(stages: { isWon?: boolean; isLost?: boolean; name: string }[]) {
    if (stages.filter((s) => s.isWon).length !== 1 || stages.filter((s) => s.isLost).length !== 1) throw new BadRequestException('A pipeline needs exactly one Won stage and one Lost stage.');
    if (stages.some((s) => s.isWon && s.isLost)) throw new BadRequestException('A stage cannot be both Won and Lost.');
  }

  /** rename + replace the ordered stage list; removing a stage that still has deals is refused */
  async updatePipeline(wsUid: string, userId: number, pipelineId: number, dto: PipelineDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    const p = await this.prisma.crmPipeline.findFirst({ where: { id: pipelineId, workspaceId: ws.id }, include: { stages: true } });
    if (!p) throw new NotFoundException('Pipeline not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.crmPipeline.update({ where: { id: p.id }, data: { name: dto.name.trim() } });
      if (!dto.stages) return;
      this.checkStages(dto.stages);
      const keep = new Set(dto.stages.map((s) => s.id).filter(Boolean) as number[]);
      for (const id of keep) if (!p.stages.some((s) => s.id === id)) throw new BadRequestException('A stage belongs to another pipeline.');
      const gone = p.stages.filter((s) => !keep.has(s.id));
      if (gone.length) {
        const used = await tx.crmDeal.count({ where: { stageId: { in: gone.map((s) => s.id) } } });
        if (used) throw new BadRequestException('Move the deals out of a stage before removing it.');
        await tx.crmStage.deleteMany({ where: { id: { in: gone.map((s) => s.id) } } });
      }
      for (const [i, s] of dto.stages.entries()) {
        const data = { name: s.name.trim(), probability: s.probability, isWon: !!s.isWon, isLost: !!s.isLost, position: i };
        if (s.id) await tx.crmStage.update({ where: { id: s.id }, data });
        else await tx.crmStage.create({ data: { ...data, pipelineId: p.id } });
      }
    });
    return this.pipelines(ws.id);
  }

  async deletePipeline(wsUid: string, userId: number, pipelineId: number) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    const p = await this.prisma.crmPipeline.findFirst({ where: { id: pipelineId, workspaceId: ws.id } });
    if (!p) throw new NotFoundException('Pipeline not found.');
    if ((await this.prisma.crmPipeline.count({ where: { workspaceId: ws.id } })) <= 1) throw new BadRequestException('Keep at least one pipeline.');
    if (await this.prisma.crmDeal.count({ where: { pipelineId: p.id } })) throw new BadRequestException('Move or delete its deals first.');
    await this.prisma.crmPipeline.delete({ where: { id: p.id } });
    return this.pipelines(ws.id);
  }

  // ── custom properties ──
  async createProperty(wsUid: string, userId: number, dto: PropertyDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    if ((dto.type === 'select' || dto.type === 'multiselect') && !dto.options?.length) throw new BadRequestException('Add at least one option.');
    let key = slug(dto.label);
    const taken = new Set((await this.prisma.crmProperty.findMany({ where: { workspaceId: ws.id, object: dto.object }, select: { key: true } })).map((x) => x.key));
    for (let i = 2; taken.has(key); i++) key = `${slug(dto.label)}_${i}`;
    const position = await this.prisma.crmProperty.count({ where: { workspaceId: ws.id, object: dto.object } });
    if (position >= 60) throw new BadRequestException('Up to 60 custom properties per object.');
    return this.prisma.crmProperty.create({ data: { workspaceId: ws.id, object: dto.object, key, label: dto.label.trim(), type: dto.type, options: [...new Set((dto.options ?? []).map((o) => o.trim()).filter(Boolean))], position } });
  }

  async updateProperty(wsUid: string, userId: number, id: number, dto: UpdatePropertyDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    const p = await this.prisma.crmProperty.findFirst({ where: { id, workspaceId: ws.id } });
    if (!p) throw new NotFoundException('Property not found.');
    return this.prisma.crmProperty.update({ where: { id }, data: { ...(dto.label !== undefined && { label: dto.label.trim() }), ...(dto.options && { options: [...new Set(dto.options.map((o) => o.trim()).filter(Boolean))] }), ...(dto.position !== undefined && { position: dto.position }) } });
  }

  async deleteProperty(wsUid: string, userId: number, id: number) {
    const { ws } = await this.access.ws(wsUid, userId, 'admin');
    const p = await this.prisma.crmProperty.findFirst({ where: { id, workspaceId: ws.id } });
    if (!p) throw new NotFoundException('Property not found.');
    await this.prisma.crmProperty.delete({ where: { id } });
    return { ok: true };
  }

  // ── saved views ──
  async views(wsUid: string, userId: number, object: string) {
    const { ws } = await this.access.ws(wsUid, userId);
    return this.prisma.crmView.findMany({ where: { workspaceId: ws.id, object }, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  }
  async createView(wsUid: string, userId: number, dto: ViewDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const position = await this.prisma.crmView.count({ where: { workspaceId: ws.id, object: dto.object } });
    if (position >= 30) throw new BadRequestException('Up to 30 saved views.');
    return this.prisma.crmView.create({ data: { workspaceId: ws.id, object: dto.object, name: dto.name.trim(), settings: (dto.settings ?? {}) as object, createdById: userId, position } });
  }
  async updateView(wsUid: string, userId: number, id: number, dto: UpdateViewDto) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const v = await this.prisma.crmView.findFirst({ where: { id, workspaceId: ws.id } });
    if (!v) throw new NotFoundException('View not found.');
    return this.prisma.crmView.update({ where: { id }, data: { ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.settings && { settings: dto.settings as object }) } });
  }
  async deleteView(wsUid: string, userId: number, id: number) {
    const { ws } = await this.access.ws(wsUid, userId, 'edit');
    const v = await this.prisma.crmView.findFirst({ where: { id, workspaceId: ws.id } });
    if (!v) throw new NotFoundException('View not found.');
    await this.prisma.crmView.delete({ where: { id } });
    return { ok: true };
  }

  // ── notifications (product "crm", kept apart from Boards and Work) ──
  async notifications(userId: number) {
    const rows = await this.prisma.notification.findMany({ where: { recipientId: userId, product: 'crm', clearedAt: null }, orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, title: true, message: true, isRead: true, createdAt: true, metadata: true } });
    return { unread: rows.filter((r) => !r.isRead).length, items: rows };
  }
  async readNotifications(userId: number) {
    await this.prisma.notification.updateMany({ where: { recipientId: userId, product: 'crm', isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { ok: true };
  }
}
