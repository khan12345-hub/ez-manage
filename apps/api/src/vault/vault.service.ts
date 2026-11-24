import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ProductAdminService } from 'src/access/product-admin.service';
import type { VaultCaller } from './vault.guard';

const USER_MINI = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } as const;
const uid = () => randomBytes(9).toString('base64url');
/** owner = "Manager" in the app (members + items), editor (items), viewer (see / copy), use_only (fill in only) */
const ROLES = ['owner', 'editor', 'viewer', 'use_only'] as const;
type Role = (typeof ROLES)[number];
const CLIENT_EVENTS = ['viewed', 'revealed', 'copied', 'filled', 'exported'] as const;
/** what a "use only" member may never do (the apps hide it; the server refuses to record / allow it) */
const USE_ONLY_BLOCKED = ['revealed', 'copied', 'exported'];
type Source = 'work' | 'boards';
const SOURCES: Source[] = ['work', 'boards'];
const RECOVERY_DAYS = 3;

/** opaque ciphertext from the browser: base64(url) with dots, bounded in size */
function blob(v: unknown, what: string, max = 200_000): string {
  if (typeof v !== 'string' || !v.length || v.length > max || !/^[A-Za-z0-9+/=_.\-]+$/.test(v)) throw new BadRequestException(`Bad ${what}.`);
  return v;
}

/**
 * EZ Vault — a zero-knowledge password manager. Everything secret arrives already encrypted;
 * the server checks who may read / write which vault and keeps an activity log.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger('Vault');
  constructor(private readonly prisma: PrismaService, @Optional() private readonly notifications?: NotificationsService, @Optional() private readonly productAdmin?: ProductAdminService) {}

  // ───────── who is who ─────────

  private async isSuperAdmin(userId: number) {
    return (await this.prisma.user.findUnique({ where: { id: userId }, select: { systemRole: true } }))?.systemRole === 'SUPER_ADMIN';
  }
  private async superAdmins() {
    return this.prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN', deletedAt: null }, select: { id: true } });
  }

  /** the companies someone belongs to, in both products */
  private async companiesOf(userId: number) {
    const [w, b] = await Promise.all([
      this.prisma.workMember.findMany({ where: { userId, workspace: { deletedAt: null } }, select: { workspace: { select: { id: true, name: true } } } }),
      this.prisma.workspaceMember.findMany({ where: { userId, deletedAt: null }, select: { workspace: { select: { id: true, name: true } } } }),
    ]);
    return [...w.map((x) => ({ source: 'work' as Source, workspaceId: x.workspace.id, name: x.workspace.name })), ...b.map((x) => ({ source: 'boards' as Source, workspaceId: x.workspace.id, name: x.workspace.name }))];
  }
  private async companyMemberIds(source: Source, workspaceId: number) {
    const rows = source === 'work'
      ? await this.prisma.workMember.findMany({ where: { workspaceId }, select: { userId: true } })
      : await this.prisma.workspaceMember.findMany({ where: { workspaceId, deletedAt: null }, select: { userId: true } });
    return new Set(rows.map((r) => r.userId));
  }
  private async companyName(source: Source, workspaceId: number) {
    const w = source === 'work'
      ? await this.prisma.workWorkspace.findUnique({ where: { id: workspaceId }, select: { name: true } })
      : await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    return w?.name ?? null;
  }
  private company(b: any): { source: Source; workspaceId: number } {
    const source = String(b?.source ?? '') as Source;
    const workspaceId = Number(b?.workspaceId);
    if (!SOURCES.includes(source) || !Number.isInteger(workspaceId) || workspaceId <= 0) throw new BadRequestException('Pick a company.');
    return { source, workspaceId };
  }
  /**
   * Vault admin for a company: the system Administrator, an EZ Vault product Administrator, or
   * someone granted it for that company. This governs vault MANAGEMENT only (members, roles,
   * structure, settings) — it never yields plaintext: reading a secret still needs the vault key
   * wrapped for the caller's own key, which a non-member product Administrator does not have.
   */
  private async canAdminCompany(userId: number, source: Source, workspaceId: number) {
    if (await this.isSuperAdmin(userId)) return true;
    if (this.productAdmin && (await this.productAdmin.is(userId, 'vault'))) return true;
    return !!(await this.prisma.vaultAdmin.findUnique({ where: { source_workspaceId_userId: { source, workspaceId, userId } }, select: { id: true } }));
  }

  private async notify(userIds: number[], title: string, message: string, meta: Record<string, unknown> = {}) {
    if (!this.notifications) return;
    for (const id of new Set(userIds)) {
      await this.notifications.notify({ recipientId: id, type: 'AUTOMATION' as any, title, message, metadata: { vault: true, href: '/vault', ...meta }, sendEmail: false })
        .catch((e) => this.logger.warn(`notify ${id}: ${e?.message}`));
    }
  }

  // ───────── setup & master password ─────────

  private async latestRecoveryKey() {
    return this.prisma.vaultRecoveryKey.findFirst({ orderBy: { version: 'desc' }, select: { version: true, publicKey: true } });
  }

  async me(c: VaultCaller) {
    const [u, keys, admin, rk, req, adminOf] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: c.userId }, select: USER_MINI }),
      this.prisma.vaultUser.findUnique({ where: { userId: c.userId } }),
      this.isSuperAdmin(c.userId),
      this.latestRecoveryKey(),
      this.prisma.vaultRecoveryRequest.findFirst({ where: { userId: c.userId, status: { in: ['pending', 'approved'] }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, createdAt: true, expiresAt: true } }),
      this.prisma.vaultAdmin.count({ where: { userId: c.userId } }),
    ]);
    return {
      user: u, via: c.via, setup: !!keys,
      keys: keys ? { salt: keys.salt, iterations: keys.iterations, publicKey: keys.publicKey, encPrivateKey: keys.encPrivateKey, verifier: keys.verifier } : null,
      isAdmin: admin, isVaultAdmin: admin || adminOf > 0,
      recovery: { enabled: !!rk, version: rk?.version ?? null, publicKey: rk?.publicKey ?? null, covered: !!keys && !!rk && keys.recoveryVersion === rk.version },
      recoveryRequest: req,
    };
  }

  private keyFields(b: any) {
    const iterations = Number(b?.iterations);
    if (!Number.isInteger(iterations) || iterations < 300_000 || iterations > 5_000_000) throw new BadRequestException('Bad key settings.');
    return { salt: blob(b?.salt, 'salt', 200), iterations, encPrivateKey: blob(b?.encPrivateKey, 'private key', 20_000), verifier: blob(b?.verifier, 'verifier', 2_000) };
  }

  /** first time: keys + the personal vault */
  async setup(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException('Set up EZ Vault in the web app.');
    if (await this.prisma.vaultUser.findUnique({ where: { userId: c.userId }, select: { userId: true } })) throw new BadRequestException('EZ Vault is already set up.');
    const f = this.keyFields(b);
    const publicKey = blob(b?.publicKey, 'public key', 5_000);
    const encName = blob(b?.personal?.encName, 'vault name', 2_000);
    const encVaultKey = blob(b?.personal?.encVaultKey, 'vault key', 5_000);
    const wrap = await this.recoveryWrapFields(b?.recovery);
    await this.prisma.$transaction(async (tx) => {
      await tx.vaultUser.create({ data: { userId: c.userId, ...f, publicKey, ...wrap } });
      const v = await tx.vault.create({ data: { uid: uid(), kind: 'personal', encName, createdById: c.userId } });
      await tx.vaultMember.create({ data: { vaultId: v.id, userId: c.userId, role: 'owner', encVaultKey, addedById: c.userId } });
    });
    await this.log(c.userId, 'setup', null, null);
    return { ok: true };
  }

  private async checkAccountPassword(userId: number, password: unknown) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!u || typeof password !== 'string' || !(await bcrypt.compare(password, u.password))) throw new UnauthorizedException('Your account password is not right.');
  }

  /** new master password: the browser re-encrypted the private key; the account password confirms it's really you */
  async changeMaster(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException('Change it in the web app.');
    await this.checkAccountPassword(c.userId, b?.accountPassword);
    const f = this.keyFields(b);
    const r = await this.prisma.vaultUser.updateMany({ where: { userId: c.userId }, data: f });
    if (!r.count) throw new BadRequestException('EZ Vault is not set up.');
    await this.log(c.userId, 'master_changed', null, null);
    return { ok: true };
  }

  /**
   * Forgot the master password and no recovery: nothing can be decrypted any more, so start over. Personal
   * items are deleted, shared vaults lose this person (others keep them), extension sign-ins end.
   */
  async reset(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException('Reset it in the web app.');
    await this.checkAccountPassword(c.userId, b?.accountPassword);
    await this.prisma.$transaction(async (tx) => {
      const personal = await tx.vault.findMany({ where: { createdById: c.userId, kind: 'personal' }, select: { id: true } });
      await tx.vault.deleteMany({ where: { id: { in: personal.map((v) => v.id) } } });
      // a shared vault that only they could open is gone too
      const mine = await tx.vaultMember.findMany({ where: { userId: c.userId }, select: { vaultId: true } });
      for (const m of mine) {
        const others = await tx.vaultMember.count({ where: { vaultId: m.vaultId, userId: { not: c.userId } } });
        if (!others) await tx.vault.delete({ where: { id: m.vaultId } });
        else {
          await tx.vaultMember.delete({ where: { vaultId_userId: { vaultId: m.vaultId, userId: c.userId } } });
          // keep at least one manager
          if (!(await tx.vaultMember.count({ where: { vaultId: m.vaultId, role: 'owner' } }))) {
            const next = await tx.vaultMember.findFirst({ where: { vaultId: m.vaultId }, orderBy: { createdAt: 'asc' } });
            if (next) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: next.vaultId, userId: next.userId } }, data: { role: 'owner' } });
          }
        }
      }
      await tx.vaultUser.delete({ where: { userId: c.userId } }).catch(() => null);
      await tx.vaultToken.updateMany({ where: { userId: c.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.vaultRecoveryRequest.updateMany({ where: { userId: c.userId, status: { in: ['pending', 'approved'] } }, data: { status: 'cancelled' } });
    });
    await this.log(c.userId, 'reset', null, null);
    return { ok: true };
  }

  // ───────── admin recovery (option B) ─────────

  private async recoveryWrapFields(r: any) {
    if (!r) return {};
    const latest = await this.latestRecoveryKey();
    if (!latest || Number(r?.version) !== latest.version) throw new BadRequestException('The recovery key changed. Reload and try again.');
    return { recoveryPriv: blob(r?.recoveryPriv, 'recovery data', 20_000), recoveryKey: blob(r?.recoveryKey, 'recovery key', 5_000), recoveryVersion: latest.version };
  }

  /** the browser adds (or refreshes) its recovery wrap after unlocking */
  async saveRecoveryWrap(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException();
    const f = await this.recoveryWrapFields(b);
    const r = await this.prisma.vaultUser.updateMany({ where: { userId: c.userId }, data: f });
    if (!r.count) throw new BadRequestException('EZ Vault is not set up.');
    return { ok: true };
  }

  /** Administrator: create (or replace) the organisation recovery key. Old wraps are refreshed on each person's next unlock. */
  async createRecoveryKey(c: VaultCaller, b: any) {
    if (c.via !== 'web' || !(await this.isSuperAdmin(c.userId))) throw new ForbiddenException('Only the Administrator can do this.');
    await this.checkAccountPassword(c.userId, b?.accountPassword);
    const iterations = Number(b?.iterations);
    if (!Number.isInteger(iterations) || iterations < 300_000 || iterations > 5_000_000) throw new BadRequestException('Bad key settings.');
    const last = await this.latestRecoveryKey();
    const k = await this.prisma.vaultRecoveryKey.create({
      data: { version: (last?.version ?? 0) + 1, publicKey: blob(b?.publicKey, 'public key', 5_000), encPrivateKey: blob(b?.encPrivateKey, 'private key', 20_000), salt: blob(b?.salt, 'salt', 200), iterations, createdById: c.userId },
    });
    await this.log(c.userId, 'recovery_key_created', null, null, { version: k.version });
    return { version: k.version };
  }

  async getRecoveryKey(c: VaultCaller) {
    if (!(await this.isSuperAdmin(c.userId))) throw new ForbiddenException('Only the Administrator can do this.');
    const k = await this.prisma.vaultRecoveryKey.findFirst({ orderBy: { version: 'desc' } });
    if (!k) return null;
    const covered = await this.prisma.vaultUser.count({ where: { recoveryVersion: k.version } });
    const total = await this.prisma.vaultUser.count();
    return { version: k.version, publicKey: k.publicKey, encPrivateKey: k.encPrivateKey, salt: k.salt, iterations: k.iterations, createdAt: k.createdAt, covered, total };
  }

  /** "Forgot master password": ask the Administrator (the one-time public key comes from this browser) */
  async requestRecovery(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException('Do this in the web app.');
    await this.checkAccountPassword(c.userId, b?.accountPassword);
    const vu = await this.prisma.vaultUser.findUnique({ where: { userId: c.userId }, select: { recoveryVersion: true } });
    if (!vu) throw new BadRequestException('EZ Vault is not set up.');
    const latest = await this.latestRecoveryKey();
    if (!latest || vu.recoveryVersion == null) throw new BadRequestException('Recovery isn’t switched on for your vault yet. You can only reset it.');
    await this.prisma.vaultRecoveryRequest.updateMany({ where: { userId: c.userId, status: { in: ['pending', 'approved'] } }, data: { status: 'cancelled' } });
    const r = await this.prisma.vaultRecoveryRequest.create({ data: { userId: c.userId, ephemeralPublicKey: blob(b?.publicKey, 'public key', 5_000), expiresAt: new Date(Date.now() + RECOVERY_DAYS * 86_400_000) } });
    await this.log(c.userId, 'recovery_requested', null, null, { request: r.id });
    const u = await this.prisma.user.findUnique({ where: { id: c.userId }, select: { firstName: true, lastName: true } });
    await this.notify((await this.superAdmins()).map((a) => a.id).filter((id) => id !== c.userId), 'EZ Vault recovery request', `${u?.firstName} ${u?.lastName} forgot their master password and asks you to recover their EZ Vault.`, { href: '/vault?admin=recovery' });
    return { id: r.id, expiresAt: r.expiresAt };
  }

  /** my open request (the wrapped keys are encrypted for my one-time key / my recovery key only) */
  async myRecovery(c: VaultCaller) {
    const r = await this.prisma.vaultRecoveryRequest.findFirst({ where: { userId: c.userId, status: { in: ['pending', 'approved', 'declined'] } }, orderBy: { createdAt: 'desc' } });
    if (!r) return null;
    const vu = r.status === 'approved' ? await this.prisma.vaultUser.findUnique({ where: { userId: c.userId }, select: { recoveryPriv: true } }) : null;
    const rk = await this.latestRecoveryKey();
    return { id: r.id, status: r.expiresAt < new Date() && r.status !== 'declined' ? 'expired' : r.status, createdAt: r.createdAt, expiresAt: r.expiresAt, wrappedKey: r.status === 'approved' ? r.wrappedKey : null, recoveryPriv: vu?.recoveryPriv ?? null, recoveryPublicKey: rk?.publicKey ?? null, recoveryVersion: rk?.version ?? null };
  }

  async cancelRecovery(c: VaultCaller) {
    await this.prisma.vaultRecoveryRequest.updateMany({ where: { userId: c.userId, status: { in: ['pending', 'approved'] } }, data: { status: 'cancelled' } });
    await this.log(c.userId, 'recovery_cancelled', null, null);
    return { ok: true };
  }

  async recoveryRequests(c: VaultCaller) {
    if (!(await this.isSuperAdmin(c.userId))) throw new ForbiddenException('Only the Administrator can do this.');
    const rows = await this.prisma.vaultRecoveryRequest.findMany({ where: { status: 'pending', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'asc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: USER_MINI });
    const vus = await this.prisma.vaultUser.findMany({ where: { userId: { in: rows.map((r) => r.userId) } }, select: { userId: true, recoveryKey: true, recoveryVersion: true } });
    return rows.map((r) => {
      const vu = vus.find((v) => v.userId === r.userId);
      return { id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt, user: users.find((u) => u.id === r.userId) ?? null, requestPublicKey: r.ephemeralPublicKey, recoveryKey: vu?.recoveryKey ?? null, recoveryVersion: vu?.recoveryVersion ?? null };
    });
  }

  /** Administrator approves: their browser sends the person's recovery key re-wrapped for the one-time key */
  async decideRecovery(c: VaultCaller, id: number, approve: boolean, b: any) {
    if (c.via !== 'web' || !(await this.isSuperAdmin(c.userId))) throw new ForbiddenException('Only the Administrator can do this.');
    const r = await this.prisma.vaultRecoveryRequest.findUnique({ where: { id } });
    if (!r || r.status !== 'pending' || r.expiresAt < new Date()) throw new NotFoundException('That request is no longer open.');
    if (r.userId === c.userId) throw new ForbiddenException('Another Administrator has to approve your own recovery.');
    await this.prisma.vaultRecoveryRequest.update({ where: { id }, data: approve ? { status: 'approved', wrappedKey: blob(b?.wrappedKey, 'wrapped key', 5_000), decidedById: c.userId, decidedAt: new Date() } : { status: 'declined', decidedById: c.userId, decidedAt: new Date() } });
    await this.log(c.userId, approve ? 'recovery_approved' : 'recovery_declined', null, null, { member: r.userId, request: id });
    await this.notify([r.userId], approve ? 'EZ Vault recovery approved' : 'EZ Vault recovery declined',
      approve ? 'Open EZ Vault in the same browser you asked from and set a new master password.' : 'The Administrator declined your EZ Vault recovery request.', { href: '/vault' });
    return { ok: true };
  }

  /** the person finishes: new master password (+ a fresh recovery wrap); only possible with an approved request */
  async completeRecovery(c: VaultCaller, b: any) {
    if (c.via !== 'web') throw new ForbiddenException('Do this in the web app.');
    const r = await this.prisma.vaultRecoveryRequest.findFirst({ where: { id: Number(b?.requestId), userId: c.userId } });
    if (!r || r.status !== 'approved' || r.expiresAt < new Date()) throw new BadRequestException('There is no approved recovery for you.');
    const f = this.keyFields(b);
    const wrap = await this.recoveryWrapFields(b?.recovery);
    await this.prisma.$transaction([
      this.prisma.vaultUser.update({ where: { userId: c.userId }, data: { ...f, ...wrap } }),
      this.prisma.vaultRecoveryRequest.update({ where: { id: r.id }, data: { status: 'completed', completedAt: new Date(), wrappedKey: null } }),
      // the old master password may be known to someone: sign browser extensions out
      this.prisma.vaultToken.updateMany({ where: { userId: c.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.log(c.userId, 'recovery_completed', null, null, { request: r.id });
    const u = await this.prisma.user.findUnique({ where: { id: c.userId }, select: { firstName: true, lastName: true } });
    await this.notify([...(await this.superAdmins()).map((a) => a.id), c.userId], 'EZ Vault recovered', `${u?.firstName} ${u?.lastName} set a new master password after recovery.`);
    return { ok: true };
  }

  // ───────── companies (Vault admins) ─────────

  /** companies I can look after: all of them for the Administrator, else the ones I was made Vault admin of */
  async adminCompanies(c: VaultCaller) {
    const admin = await this.isSuperAdmin(c.userId);
    let list: { source: Source; workspaceId: number; name: string }[];
    if (admin) {
      const [w, b] = await Promise.all([
        this.prisma.workWorkspace.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        this.prisma.workspace.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      ]);
      list = [...w.map((x) => ({ source: 'work' as Source, workspaceId: x.id, name: x.name })), ...b.map((x) => ({ source: 'boards' as Source, workspaceId: x.id, name: x.name }))];
    } else {
      const mine = await this.prisma.vaultAdmin.findMany({ where: { userId: c.userId }, select: { source: true, workspaceId: true } });
      list = [];
      for (const m of mine) list.push({ source: m.source as Source, workspaceId: m.workspaceId, name: (await this.companyName(m.source as Source, m.workspaceId)) ?? 'Company' });
    }
    if (!list.length) return [];
    const [settings, admins, vaults] = await Promise.all([
      this.prisma.vaultCompany.findMany({ where: { OR: list.map((x) => ({ source: x.source, workspaceId: x.workspaceId })) } }),
      this.prisma.vaultAdmin.findMany({ where: { OR: list.map((x) => ({ source: x.source, workspaceId: x.workspaceId })) } }),
      this.prisma.vault.groupBy({ by: ['companySource', 'companyWorkspaceId'], where: { deletedAt: null, companySource: { not: null } }, _count: { _all: true } }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: admins.map((a) => a.userId) } }, select: USER_MINI });
    return list.map((x) => ({
      ...x,
      allowOutsideSharing: settings.find((s) => s.source === x.source && s.workspaceId === x.workspaceId)?.allowOutsideSharing ?? true,
      admins: admins.filter((a) => a.source === x.source && a.workspaceId === x.workspaceId).map((a) => users.find((u) => u.id === a.userId)).filter(Boolean),
      vaults: vaults.find((v) => v.companySource === x.source && v.companyWorkspaceId === x.workspaceId)?._count._all ?? 0,
    }));
  }

  async companySettings(c: VaultCaller, b: any) {
    const { source, workspaceId } = this.company(b);
    if (!(await this.canAdminCompany(c.userId, source, workspaceId))) throw new ForbiddenException('Only a Vault admin of this company can change this.');
    const allow = !!b?.allowOutsideSharing;
    await this.prisma.vaultCompany.upsert({ where: { source_workspaceId: { source, workspaceId } }, create: { source, workspaceId, allowOutsideSharing: allow, updatedById: c.userId }, update: { allowOutsideSharing: allow, updatedById: c.userId } });
    await this.log(c.userId, 'company_setting', null, null, { source, workspaceId, allowOutsideSharing: allow });
    return { ok: true };
  }

  /** people of a company (for the Vault admin picker) */
  async companyPeople(c: VaultCaller, b: any) {
    const { source, workspaceId } = this.company(b);
    if (!(await this.canAdminCompany(c.userId, source, workspaceId))) throw new ForbiddenException('Only a Vault admin of this company can see this.');
    const ids = [...(await this.companyMemberIds(source, workspaceId))];
    return this.prisma.user.findMany({ where: { id: { in: ids }, deletedAt: null }, select: USER_MINI, orderBy: { firstName: 'asc' }, take: 500 });
  }

  async setVaultAdmin(c: VaultCaller, b: any, on: boolean) {
    const { source, workspaceId } = this.company(b);
    if (!(await this.canAdminCompany(c.userId, source, workspaceId))) throw new ForbiddenException('Only a Vault admin of this company can change this.');
    const userId = Number(b?.userId);
    if (on) {
      if (!(await this.companyMemberIds(source, workspaceId)).has(userId)) throw new BadRequestException('They have to be in the company first.');
      await this.prisma.vaultAdmin.upsert({ where: { source_workspaceId_userId: { source, workspaceId, userId } }, create: { source, workspaceId, userId, grantedById: c.userId }, update: {} });
      await this.notify([userId], 'You are a Vault admin', `You can now create and look after EZ Vault vaults for ${(await this.companyName(source, workspaceId)) ?? 'a company'}.`);
    } else await this.prisma.vaultAdmin.deleteMany({ where: { source, workspaceId, userId } });
    await this.log(c.userId, on ? 'vault_admin_added' : 'vault_admin_removed', null, null, { member: userId, source, workspaceId });
    return { ok: true };
  }

  // ───────── vaults ─────────

  private async member(vaultUid: string, userId: number, need: 'read' | 'write' | 'owner') {
    const v = await this.prisma.vault.findFirst({ where: { uid: String(vaultUid ?? ''), deletedAt: null } });
    if (!v) throw new NotFoundException('Vault not found.');
    const m = await this.prisma.vaultMember.findUnique({ where: { vaultId_userId: { vaultId: v.id, userId } } });
    if (!m) throw new NotFoundException('Vault not found.');
    if (need === 'write' && (m.role === 'viewer' || m.role === 'use_only')) throw new ForbiddenException('You can only use this vault.');
    if (need === 'owner' && m.role !== 'owner') throw new ForbiddenException('Only a manager of this vault can do this.');
    return { v, m };
  }

  async vaults(c: VaultCaller) {
    const rows = await this.prisma.vaultMember.findMany({
      where: { userId: c.userId, vault: { deletedAt: null } },
      select: { role: true, encVaultKey: true, keyVersion: true, vault: { select: { id: true, uid: true, kind: true, encName: true, keyVersion: true, createdById: true, createdAt: true, companySource: true, companyWorkspaceId: true, needsRekey: true, _count: { select: { members: true, items: { where: { deletedAt: null } } } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const names = new Map<string, string | null>();
    for (const r of rows) if (r.vault.companySource && r.vault.companyWorkspaceId) {
      const k = `${r.vault.companySource}:${r.vault.companyWorkspaceId}`;
      if (!names.has(k)) names.set(k, await this.companyName(r.vault.companySource as Source, r.vault.companyWorkspaceId));
    }
    return rows.map((r) => ({
      uid: r.vault.uid, kind: r.vault.kind, encName: r.vault.encName, keyVersion: r.vault.keyVersion, role: r.role, encVaultKey: r.encVaultKey, memberKeyVersion: r.keyVersion,
      members: r.vault._count.members, items: r.vault._count.items, createdById: r.vault.createdById, createdAt: r.vault.createdAt, needsRekey: r.vault.needsRekey,
      company: r.vault.companySource && r.vault.companyWorkspaceId ? { source: r.vault.companySource, workspaceId: r.vault.companyWorkspaceId, name: names.get(`${r.vault.companySource}:${r.vault.companyWorkspaceId}`) ?? 'Company' } : null,
    }));
  }

  async createVault(c: VaultCaller, b: any) {
    if (!(await this.prisma.vaultUser.findUnique({ where: { userId: c.userId }, select: { userId: true } }))) throw new BadRequestException('Set up EZ Vault first.');
    let company: { source: Source; workspaceId: number } | null = null;
    if (b?.company) {
      company = this.company(b.company);
      if (!(await this.canAdminCompany(c.userId, company.source, company.workspaceId))) throw new ForbiddenException('Only a Vault admin of this company can create its vaults.');
    }
    const v = await this.prisma.vault.create({ data: { uid: uid(), kind: 'shared', encName: blob(b?.encName, 'vault name', 2_000), createdById: c.userId, companySource: company?.source ?? null, companyWorkspaceId: company?.workspaceId ?? null } });
    await this.prisma.vaultMember.create({ data: { vaultId: v.id, userId: c.userId, role: 'owner', encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), addedById: c.userId } });
    await this.log(c.userId, 'vault_created', v.id, null, { via: c.via, ...(company ? { company: `${company.source}:${company.workspaceId}` } : {}) });
    return { uid: v.uid };
  }

  async renameVault(c: VaultCaller, vaultUid: string, b: any) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    await this.prisma.vault.update({ where: { id: v.id }, data: { encName: blob(b?.encName, 'vault name', 2_000) } });
    await this.log(c.userId, 'vault_renamed', v.id, null);
    return { ok: true };
  }

  async deleteVault(c: VaultCaller, vaultUid: string) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    if (v.kind === 'personal') throw new BadRequestException('Your personal vault can’t be deleted.');
    await this.prisma.vault.update({ where: { id: v.id }, data: { deletedAt: new Date() } });
    await this.log(c.userId, 'vault_deleted', v.id, null);
    return { ok: true };
  }

  // ───────── items ─────────

  private shapeItem = { uid: true, data: true, keyVersion: true, createdAt: true, updatedAt: true, deletedAt: true, createdById: true, updatedById: true, vault: { select: { uid: true } } } as const;

  /** every item in every vault I'm in (ciphertext) */
  async items(c: VaultCaller, trash = false) {
    const rows = await this.prisma.vaultItem.findMany({
      where: { vault: { deletedAt: null, members: { some: { userId: c.userId } } }, deletedAt: trash ? { not: null } : null },
      select: this.shapeItem, orderBy: { updatedAt: 'desc' }, take: 5000,
    });
    return rows.map(({ vault, ...r }) => ({ ...r, vaultUid: vault.uid }));
  }

  async createItem(c: VaultCaller, vaultUid: string, b: any) {
    const { v } = await this.member(vaultUid, c.userId, 'write');
    if (Number(b?.keyVersion) !== v.keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    const it = await this.prisma.vaultItem.create({ data: { uid: uid(), vaultId: v.id, data: blob(b?.data, 'item'), keyVersion: v.keyVersion, createdById: c.userId, updatedById: c.userId }, select: { ...this.shapeItem, id: true } });
    await this.log(c.userId, 'created', v.id, it.id, { via: c.via });
    const { vault, id: _id, ...r } = it;
    return { ...r, vaultUid: vault.uid };
  }

  private async itemOf(itemUid: string, userId: number, need: 'read' | 'write') {
    const it = await this.prisma.vaultItem.findUnique({ where: { uid: String(itemUid ?? '') }, select: { id: true, vaultId: true, deletedAt: true, vault: { select: { uid: true } } } });
    if (!it) throw new NotFoundException('Item not found.');
    const { v, m } = await this.member(it.vault.uid, userId, need);
    return { it, v, m };
  }

  async updateItem(c: VaultCaller, itemUid: string, b: any) {
    const { it, v } = await this.itemOf(itemUid, c.userId, 'write');
    const moving = !!b?.vaultUid && b.vaultUid !== v.uid;
    if (!moving && Number(b?.keyVersion) !== v.keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    // moving to another vault: the browser re-encrypted it with that vault's key
    let vaultId = v.id;
    if (moving) {
      const t = await this.member(String(b.vaultUid), c.userId, 'write');
      if (Number(b?.keyVersion) !== t.v.keyVersion) throw new BadRequestException('That vault’s key changed. Reload and try again.');
      vaultId = t.v.id;
    }
    const u = await this.prisma.vaultItem.update({ where: { id: it.id }, data: { data: blob(b?.data, 'item'), vaultId, updatedById: c.userId, keyVersion: Number(b.keyVersion) }, select: this.shapeItem });
    await this.log(c.userId, vaultId !== v.id ? 'moved' : 'updated', vaultId, it.id, { via: c.via });
    const { vault, ...r } = u;
    return { ...r, vaultUid: vault.uid };
  }

  /**
   * After the browser propagated a password to the same login in other shared vaults, let those
   * vaults' members know. Zero-knowledge: the server only learns the vault ids (never the secret,
   * the url or the title), and the copies are already updated — this is a courtesy notice.
   */
  async passwordUpdated(c: VaultCaller, vaultUids: unknown) {
    const uids = Array.isArray(vaultUids) ? [...new Set(vaultUids.map((x) => String(x)))].slice(0, 50) : [];
    let notified = 0;
    for (const uid of uids) {
      let vaultId: number;
      try { vaultId = (await this.member(uid, c.userId, 'write')).v.id; } catch { continue; }
      const members = await this.prisma.vaultMember.findMany({ where: { vaultId, userId: { not: c.userId } }, select: { userId: true } });
      const ids = members.map((m) => m.userId);
      if (ids.length) {
        await this.notify(ids, 'A shared password was updated', 'A login in a shared vault you can open had its password changed — your copy is already up to date.', { vault: uid });
        notified += ids.length;
      }
      await this.log(c.userId, 'password_propagated', vaultId, null, { via: c.via });
    }
    return { notified };
  }

  // ───────── emergency / full access ─────────

  private pubGrant(g: any) {
    const { encVaultKey, keyVersion, ...r } = g; // never expose the wrapped key through the grant API
    return r;
  }
  private async grantFromMe(c: VaultCaller, id: number) {
    const g = await this.prisma.vaultEmergencyGrant.findFirst({ where: { id: Number(id), granterId: c.userId } });
    if (!g) throw new NotFoundException('Grant not found.');
    return g;
  }
  private async grantToMe(c: VaultCaller, id: number) {
    const g = await this.prisma.vaultEmergencyGrant.findFirst({ where: { id: Number(id), granteeId: c.userId } });
    if (!g) throw new NotFoundException('Grant not found.');
    return g;
  }
  /** turn a grant on: make the grantee a real member of the granter's vault using the stored wrapped key */
  private async activateGrant(g: { id: number; vaultId: number; granteeId: number; granterId: number; role: string; encVaultKey: string; keyVersion: number }) {
    await this.prisma.vaultMember.upsert({
      where: { vaultId_userId: { vaultId: g.vaultId, userId: g.granteeId } },
      create: { vaultId: g.vaultId, userId: g.granteeId, role: g.role, encVaultKey: g.encVaultKey, keyVersion: g.keyVersion, addedById: g.granterId },
      update: { role: g.role, encVaultKey: g.encVaultKey, keyVersion: g.keyVersion },
    });
    await this.prisma.vaultEmergencyGrant.update({ where: { id: g.id }, data: { status: 'active', activatedAt: new Date() } });
    await this.log(g.granterId, 'emergency_activated', g.vaultId, null, { grantee: g.granteeId });
  }

  async emergencyList(c: VaultCaller) {
    const [given, received] = await Promise.all([
      this.prisma.vaultEmergencyGrant.findMany({ where: { granterId: c.userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.vaultEmergencyGrant.findMany({ where: { granteeId: c.userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    // wait-mode grants to me whose time has elapsed turn on now (works even if the granter is offline)
    for (const g of received) {
      if (g.status === 'requested' && g.mode === 'wait' && g.activatesAt && g.activatesAt <= new Date()) {
        await this.activateGrant(g); g.status = 'active'; g.activatedAt = new Date();
      }
    }
    const ids = [...new Set([...given.map((g) => g.granteeId), ...received.map((g) => g.granterId)])];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: USER_MINI });
    const by = (id: number) => users.find((u) => u.id === id) ?? null;
    return {
      given: given.map((g) => ({ ...this.pubGrant(g), grantee: by(g.granteeId) })),
      received: received.map((g) => ({ ...this.pubGrant(g), granter: by(g.granterId) })),
    };
  }

  async emergencyCreate(c: VaultCaller, b: any) {
    const { v } = await this.member(String(b?.vaultUid ?? ''), c.userId, 'owner');
    const granteeId = Number(b?.granteeId);
    if (!granteeId || granteeId === c.userId) throw new BadRequestException('Pick someone else to trust.');
    const role = ['viewer', 'editor', 'owner'].includes(String(b?.role)) ? String(b.role) : 'viewer';
    const mode = b?.mode === 'wait' ? 'wait' : 'approval';
    const waitDays = Math.max(0, Math.min(90, Number(b?.waitDays) || 3));
    const target = await this.prisma.user.findFirst({ where: { id: granteeId, deletedAt: null }, select: { id: true } });
    if (!target) throw new BadRequestException('Only people with an EZ Manage account can be trusted.');
    if (!(await this.prisma.vaultUser.findUnique({ where: { userId: granteeId }, select: { userId: true } }))) throw new BadRequestException('They haven’t set up EZ Vault yet.');
    const encVaultKey = blob(b?.encVaultKey, 'vault key', 5_000);
    const g = await this.prisma.vaultEmergencyGrant.upsert({
      where: { granterId_granteeId: { granterId: c.userId, granteeId } },
      create: { granterId: c.userId, granteeId, vaultId: v.id, role, mode, waitDays, encVaultKey, keyVersion: v.keyVersion, status: 'offered' },
      update: { vaultId: v.id, role, mode, waitDays, encVaultKey, keyVersion: v.keyVersion, status: 'offered', requestedAt: null, activatesAt: null, activatedAt: null },
    });
    await this.notify([granteeId], 'Emergency access offered', 'Someone gave you emergency access to their EZ Vault. Open EZ Vault to see it.', { grant: g.id });
    return this.pubGrant(g);
  }

  /** grantee asks to open it (approval mode waits for the granter; wait mode counts down) */
  async emergencyRequest(c: VaultCaller, id: number) {
    const g = await this.grantToMe(c, id);
    if (!['offered', 'declined'].includes(g.status)) throw new BadRequestException('This access can’t be requested right now.');
    const data = g.mode === 'wait'
      ? { status: 'requested', requestedAt: new Date(), activatesAt: new Date(Date.now() + g.waitDays * 86_400_000) }
      : { status: 'requested', requestedAt: new Date(), activatesAt: null };
    const up = await this.prisma.vaultEmergencyGrant.update({ where: { id: g.id }, data });
    await this.notify([g.granterId], 'Emergency access requested',
      g.mode === 'wait' ? `Someone you trusted asked to open your vault. It opens in ${g.waitDays} day${g.waitDays === 1 ? '' : 's'} unless you decline.` : 'Someone you trusted asked to open your vault. Approve or decline in EZ Vault.',
      { grant: g.id });
    return this.pubGrant(up);
  }

  /** granter approves (or force-opens early for a wait grant) */
  async emergencyApprove(c: VaultCaller, id: number) {
    const g = await this.grantFromMe(c, id);
    if (g.status === 'active') return this.pubGrant(g);
    await this.activateGrant(g);
    await this.notify([g.granteeId], 'Emergency access granted', 'You can now open their EZ Vault.', { grant: g.id });
    const up = await this.prisma.vaultEmergencyGrant.findUnique({ where: { id: g.id } });
    return this.pubGrant(up);
  }

  /** granter declines a request or cancels a pending wait countdown */
  async emergencyDecline(c: VaultCaller, id: number) {
    const g = await this.grantFromMe(c, id);
    const up = await this.prisma.vaultEmergencyGrant.update({ where: { id: g.id }, data: { status: 'declined', activatesAt: null } });
    await this.notify([g.granteeId], 'Emergency access declined', 'Your request to open their vault was declined.', { grant: g.id });
    return this.pubGrant(up);
  }

  /** granter removes access entirely (re-keys the vault if it was already open to them) */
  async emergencyRevoke(c: VaultCaller, id: number) {
    const g = await this.grantFromMe(c, id);
    if (g.status === 'active') {
      await this.prisma.vaultMember.deleteMany({ where: { vaultId: g.vaultId, userId: g.granteeId } });
      await this.prisma.vault.update({ where: { id: g.vaultId }, data: { needsRekey: true } });
    }
    await this.prisma.vaultEmergencyGrant.delete({ where: { id: g.id } });
    await this.notify([g.granteeId], 'Emergency access removed', 'Your emergency access to their EZ Vault was removed.', {});
    await this.log(c.userId, 'emergency_revoked', g.vaultId, null, { grantee: g.granteeId });
    return { ok: true };
  }

  /** grantee gives up their own access */
  async emergencyLeave(c: VaultCaller, id: number) {
    const g = await this.grantToMe(c, id);
    if (g.status === 'active') {
      await this.prisma.vaultMember.deleteMany({ where: { vaultId: g.vaultId, userId: c.userId } });
      await this.prisma.vault.update({ where: { id: g.vaultId }, data: { needsRekey: true } });
    }
    await this.prisma.vaultEmergencyGrant.update({ where: { id: g.id }, data: { status: 'declined', activatesAt: null } });
    return { ok: true };
  }

  async deleteItem(c: VaultCaller, itemUid: string, forever = false) {
    const { it, v } = await this.itemOf(itemUid, c.userId, 'write');
    if (forever) {
      if (!it.deletedAt) throw new BadRequestException('Move it to the trash first.');
      await this.prisma.vaultItem.delete({ where: { id: it.id } });
    } else await this.prisma.vaultItem.update({ where: { id: it.id }, data: { deletedAt: new Date(), updatedById: c.userId } });
    await this.log(c.userId, forever ? 'purged' : 'deleted', v.id, forever ? null : it.id, { via: c.via });
    return { ok: true };
  }

  async restoreItem(c: VaultCaller, itemUid: string) {
    const { it, v } = await this.itemOf(itemUid, c.userId, 'write');
    await this.prisma.vaultItem.update({ where: { id: it.id }, data: { deletedAt: null, updatedById: c.userId } });
    await this.log(c.userId, 'restored', v.id, it.id);
    return { ok: true };
  }

  // ───────── sharing ─────────

  /**
   * People I can share with: my companies' people (for a company vault: that company's people), plus — only
   * when searching by a full email address — any other EZ Manage user (marked "outside").
   */
  async people(c: VaultCaller, q?: string, vaultUid?: string) {
    let ids = new Set<number>();
    let scope: { source: Source; workspaceId: number } | null = null;
    if (vaultUid) {
      const { v } = await this.member(vaultUid, c.userId, 'read');
      if (v.companySource && v.companyWorkspaceId) scope = { source: v.companySource as Source, workspaceId: v.companyWorkspaceId };
    }
    if (scope) ids = await this.companyMemberIds(scope.source, scope.workspaceId);
    else for (const co of await this.companiesOf(c.userId)) for (const id of await this.companyMemberIds(co.source, co.workspaceId)) ids.add(id);
    ids.delete(c.userId);
    const term = String(q ?? '').trim();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, deletedAt: null, ...(term ? { OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {}) },
      select: USER_MINI, take: 50, orderBy: { firstName: 'asc' },
    });
    const out: (typeof users[number] & { outside: boolean })[] = users.map((u) => ({ ...u, outside: false }));
    // outside the company: only on an exact email (no browsing other companies' people)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term) && !out.some((u) => u.email.toLowerCase() === term.toLowerCase())) {
      const x = await this.prisma.user.findFirst({ where: { email: { equals: term, mode: 'insensitive' }, deletedAt: null, id: { not: c.userId } }, select: USER_MINI });
      if (x) out.push({ ...x, outside: true });
    }
    const keys = await this.prisma.vaultUser.findMany({ where: { userId: { in: out.map((u) => u.id) } }, select: { userId: true, publicKey: true } });
    return out.map((u) => ({ ...u, publicKey: keys.find((k) => k.userId === u.id)?.publicKey ?? null }));
  }

  /** is this person outside the vault's company (or outside all of my companies), and is that allowed? */
  private async outsideCheck(ownerId: number, v: { companySource: string | null; companyWorkspaceId: number | null }, userId: number) {
    if (v.companySource && v.companyWorkspaceId) {
      const source = v.companySource as Source;
      const outside = !(await this.companyMemberIds(source, v.companyWorkspaceId)).has(userId);
      const s = await this.prisma.vaultCompany.findUnique({ where: { source_workspaceId: { source, workspaceId: v.companyWorkspaceId } } });
      return { outside, blocked: outside && s?.allowOutsideSharing === false };
    }
    const mine = await this.companiesOf(ownerId);
    let outside = true;
    for (const co of mine) if ((await this.companyMemberIds(co.source, co.workspaceId)).has(userId)) { outside = false; break; }
    if (!outside) return { outside, blocked: false };
    const off = mine.length ? await this.prisma.vaultCompany.count({ where: { allowOutsideSharing: false, OR: mine.map((co) => ({ source: co.source, workspaceId: co.workspaceId })) } }) : 0;
    return { outside, blocked: off > 0 };
  }

  async members(c: VaultCaller, vaultUid: string) {
    const { v } = await this.member(vaultUid, c.userId, 'read');
    const rows = await this.prisma.vaultMember.findMany({ where: { vaultId: v.id }, orderBy: { createdAt: 'asc' }, select: { userId: true, role: true, createdAt: true } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: USER_MINI });
    const keys = await this.prisma.vaultUser.findMany({ where: { userId: { in: rows.map((r) => r.userId) } }, select: { userId: true, publicKey: true } });
    return rows.map((r) => ({ role: r.role, since: r.createdAt, user: users.find((u) => u.id === r.userId) ?? null, publicKey: keys.find((k) => k.userId === r.userId)?.publicKey ?? null }));
  }

  async addMember(c: VaultCaller, vaultUid: string, b: any) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    if (v.kind === 'personal') throw new BadRequestException('Your personal vault is only yours. Make a shared vault to share.');
    const userId = Number(b?.userId);
    const role = String(b?.role ?? 'viewer') as Role;
    if (!ROLES.includes(role)) throw new BadRequestException('Unknown role.');
    const target = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true } });
    if (!target) throw new BadRequestException('Only people with an EZ Manage account can be added.');
    if (!(await this.prisma.vaultUser.findUnique({ where: { userId }, select: { userId: true } }))) throw new BadRequestException(`${target.firstName} hasn’t set up EZ Vault yet.`);
    const { outside, blocked } = await this.outsideCheck(c.userId, v, userId);
    if (blocked) throw new ForbiddenException('Sharing outside the company is turned off for this company.');
    if (Number(b?.keyVersion) !== v.keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    await this.prisma.vaultMember.upsert({
      where: { vaultId_userId: { vaultId: v.id, userId } },
      create: { vaultId: v.id, userId, role, encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), keyVersion: v.keyVersion, addedById: c.userId },
      update: { role, encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), keyVersion: v.keyVersion },
    });
    await this.log(c.userId, outside ? 'shared_outside' : 'member_added', v.id, null, { member: userId, role });
    if (outside) {
      const managers = await this.prisma.vaultMember.findMany({ where: { vaultId: v.id, role: 'owner', userId: { not: c.userId } }, select: { userId: true } });
      const by = await this.prisma.user.findUnique({ where: { id: c.userId }, select: { firstName: true, lastName: true } });
      await this.notify([...managers.map((m) => m.userId), ...(await this.superAdmins()).map((a) => a.id)].filter((id) => id !== c.userId),
        'EZ Vault shared outside the company', `${by?.firstName} ${by?.lastName} gave ${target.firstName} ${target.lastName} (${target.email}) access to a vault. They are not in the company.`);
    }
    return { ok: true, outside };
  }

  async setRole(c: VaultCaller, vaultUid: string, userId: number, role: string) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    if (!ROLES.includes(role as Role)) throw new BadRequestException('Unknown role.');
    if (userId === c.userId && role !== 'owner' && (await this.prisma.vaultMember.count({ where: { vaultId: v.id, role: 'owner' } })) < 2) throw new BadRequestException('A vault needs at least one manager.');
    const r = await this.prisma.vaultMember.updateMany({ where: { vaultId: v.id, userId }, data: { role } });
    if (!r.count) throw new NotFoundException('Not a member.');
    await this.log(c.userId, 'member_role', v.id, null, { member: userId, role });
    return { ok: true };
  }

  /** what someone could open in a vault right now (+ what they actually looked at), for "Passwords to change" */
  private async exposure(tx: Prisma.TransactionClient, vaultId: number, userId: number) {
    const items = await tx.vaultItem.findMany({ where: { vaultId, deletedAt: null }, select: { id: true } });
    const seen = await tx.vaultEvent.findMany({ where: { vaultId, userId, itemId: { in: items.map((i) => i.id) }, action: { in: ['viewed', 'revealed', 'copied', 'filled', 'exported'] } }, select: { itemId: true, action: true } });
    return items.map((i) => ({ itemId: i.id, seen: [...new Set(seen.filter((s) => s.itemId === i.id).map((s) => s.action))] }));
  }

  /** a new vault key for the given members, every item re-encrypted with it (all in one go) */
  private async applyRekey(tx: Prisma.TransactionClient, v: { id: number; keyVersion: number }, stay: { userId: number; role: string }[], b: any) {
    const keyVersion = v.keyVersion + 1;
    const keys: { userId: number; encVaultKey: string }[] = Array.isArray(b?.members) ? b.members : [];
    const items: { uid: string; data: string }[] = Array.isArray(b?.items) ? b.items : [];
    if (Number(b?.keyVersion) !== keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    const want = new Set(stay.map((m) => m.userId));
    if (keys.length !== want.size || !keys.every((k) => want.has(Number(k.userId)))) throw new BadRequestException('A new key is needed for everyone who stays.');
    const all = await tx.vaultItem.findMany({ where: { vaultId: v.id }, select: { id: true, uid: true } });
    const byUid = new Map(items.map((i) => [String(i.uid), i.data]));
    if (all.length !== items.length || !all.every((i) => byUid.has(i.uid))) throw new BadRequestException('Every item must be re-encrypted. Reload and try again.');
    // the vault's name is encrypted with the vault key too: it must move to the new key
    const encName = blob(b?.encName, 'vault name', 2_000);
    for (const k of keys) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: v.id, userId: Number(k.userId) } }, data: { encVaultKey: blob(k.encVaultKey, 'vault key', 5_000), keyVersion } });
    for (const i of all) await tx.vaultItem.update({ where: { id: i.id }, data: { data: blob(byUid.get(i.uid), 'item'), keyVersion } });
    await tx.vault.update({ where: { id: v.id }, data: { keyVersion, needsRekey: false, encName } });
    return keyVersion;
  }

  /**
   * Remove someone. They may have seen the old key, so the browser sends a fresh key for everyone
   * who stays and every item re-encrypted with it; it all switches over in one go. What they could
   * open is kept as a "Passwords to change" list.
   */
  async removeMember(c: VaultCaller, vaultUid: string, userId: number, b: any) {
    const leaving = userId === c.userId;
    const { v } = await this.member(vaultUid, c.userId, leaving ? 'read' : 'owner');
    if (v.kind === 'personal') throw new BadRequestException('Not possible for a personal vault.');
    const members = await this.prisma.vaultMember.findMany({ where: { vaultId: v.id }, select: { userId: true, role: true } });
    if (!members.some((m) => m.userId === userId)) throw new NotFoundException('Not a member.');
    const stay = members.filter((m) => m.userId !== userId);
    if (!stay.length) throw new BadRequestException('You are the last member. Delete the vault instead.');
    let keyVersion = 0;
    await this.prisma.$transaction(async (tx) => {
      const exposed = await this.exposure(tx, v.id, userId);
      await tx.vaultMember.delete({ where: { vaultId_userId: { vaultId: v.id, userId } } });
      keyVersion = await this.applyRekey(tx, v, stay, b);
      if (!stay.some((m) => m.role === 'owner')) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: v.id, userId: stay[0].userId } }, data: { role: 'owner' } });
      if (exposed.length) await tx.vaultRotation.create({ data: { vaultId: v.id, removedUserId: userId, removedById: c.userId, items: exposed as unknown as Prisma.InputJsonValue } });
    }, { timeout: 60_000 });
    await this.log(c.userId, leaving ? 'left' : 'member_removed', v.id, null, { member: userId, keyVersion });
    return { ok: true, keyVersion };
  }

  /** a vault flagged "needs a new key" (someone was taken out without one): a manager's browser re-keys it */
  async rekey(c: VaultCaller, vaultUid: string, b: any) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    const stay = await this.prisma.vaultMember.findMany({ where: { vaultId: v.id }, select: { userId: true, role: true } });
    let keyVersion = 0;
    await this.prisma.$transaction(async (tx) => { keyVersion = await this.applyRekey(tx, v, stay, b); }, { timeout: 60_000 });
    await this.log(c.userId, 'rekeyed', v.id, null, { keyVersion });
    return { ok: true, keyVersion };
  }

  /**
   * Take someone out of every shared vault at once (e.g. the Administrator disabled them). There is no
   * browser here to make new keys, so each vault is flagged: its next manager to open it re-keys it
   * automatically. Their extension sign-ins end.
   */
  async removeUserEverywhere(userId: number, actorId: number | null) {
    const rows = await this.prisma.vaultMember.findMany({ where: { userId, vault: { kind: 'shared', deletedAt: null } }, select: { vaultId: true, role: true } });
    let removed = 0;
    for (const r of rows) {
      const others = await this.prisma.vaultMember.findMany({ where: { vaultId: r.vaultId, userId: { not: userId } }, select: { userId: true, role: true }, orderBy: { createdAt: 'asc' } });
      if (!others.length) continue; // only they can open it: leave it (it stays locked to them)
      await this.prisma.$transaction(async (tx) => {
        const exposed = await this.exposure(tx, r.vaultId, userId);
        await tx.vaultMember.delete({ where: { vaultId_userId: { vaultId: r.vaultId, userId } } });
        if (!others.some((o) => o.role === 'owner')) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: r.vaultId, userId: others[0].userId } }, data: { role: 'owner' } });
        await tx.vault.update({ where: { id: r.vaultId }, data: { needsRekey: true } });
        if (exposed.length) await tx.vaultRotation.create({ data: { vaultId: r.vaultId, removedUserId: userId, removedById: actorId, items: exposed as unknown as Prisma.InputJsonValue } });
      });
      await this.log(actorId ?? userId, 'member_removed', r.vaultId, null, { member: userId, via: 'disabled' });
      removed++;
    }
    await this.prisma.vaultToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { removed };
  }

  async adminRemoveEverywhere(c: VaultCaller, userId: number) {
    if (!(await this.isSuperAdmin(c.userId))) throw new ForbiddenException('Only the Administrator can do this.');
    return this.removeUserEverywhere(userId, c.userId);
  }

  /** "Passwords to change": for each removal, the items that person could open (managers / Administrator) */
  async rotations(c: VaultCaller, vaultUid: string) {
    const v = await this.prisma.vault.findFirst({ where: { uid: String(vaultUid ?? ''), deletedAt: null } });
    if (!v) throw new NotFoundException('Vault not found.');
    const m = await this.prisma.vaultMember.findUnique({ where: { vaultId_userId: { vaultId: v.id, userId: c.userId } } });
    if (m?.role !== 'owner' && !(v.companySource && (await this.isSuperAdmin(c.userId)))) throw new NotFoundException('Vault not found.');
    const rows = await this.prisma.vaultRotation.findMany({ where: { vaultId: v.id }, orderBy: { removedAt: 'desc' }, take: 50 });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.flatMap((r) => [r.removedUserId, r.removedById ?? 0]) } }, select: USER_MINI });
    const ids = [...new Set(rows.flatMap((r) => (r.items as any[]).map((i) => Number(i.itemId))))];
    const items = await this.prisma.vaultItem.findMany({ where: { id: { in: ids } }, select: { id: true, uid: true, updatedAt: true, deletedAt: true } });
    return rows.map((r) => ({
      id: r.id, removedAt: r.removedAt, removed: users.find((u) => u.id === r.removedUserId) ?? null, by: users.find((u) => u.id === r.removedById) ?? null,
      items: (r.items as any[]).map((i) => {
        const it = items.find((x) => x.id === Number(i.itemId));
        return { itemId: Number(i.itemId), itemUid: it?.uid ?? null, gone: !it || !!it.deletedAt, seen: Array.isArray(i.seen) ? i.seen : [], resolved: r.resolvedItemIds.includes(Number(i.itemId)), editedSince: !!it && it.updatedAt > r.removedAt };
      }),
    }));
  }

  async resolveRotation(c: VaultCaller, id: number, b: any) {
    const r = await this.prisma.vaultRotation.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Not found.');
    const v = await this.prisma.vault.findUnique({ where: { id: r.vaultId }, select: { uid: true } });
    await this.rotations(c, v?.uid ?? ''); // same permission check
    const itemId = Number(b?.itemId);
    if (!(r.items as any[]).some((i) => Number(i.itemId) === itemId)) throw new BadRequestException('Not in this list.');
    const set = new Set(r.resolvedItemIds);
    if (b?.resolved === false) set.delete(itemId); else set.add(itemId);
    await this.prisma.vaultRotation.update({ where: { id }, data: { resolvedItemIds: [...set] } });
    await this.log(c.userId, 'password_changed_marked', r.vaultId, itemId, { resolved: b?.resolved !== false });
    return { ok: true };
  }

  // ───────── activity ─────────

  async log(userId: number, action: string, vaultId: number | null, itemId: number | null, meta?: Record<string, unknown>) {
    await this.prisma.vaultEvent.create({ data: { userId, action, vaultId, itemId, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined } }).catch(() => null);
  }

  /** the browser tells us when a secret was viewed / copied / filled ("use only" members may only fill) */
  async clientEvent(c: VaultCaller, b: any) {
    const action = String(b?.action ?? '');
    if (!(CLIENT_EVENTS as readonly string[]).includes(action)) throw new BadRequestException('Unknown event.');
    const { it, v, m } = await this.itemOf(String(b?.itemUid ?? ''), c.userId, 'read');
    if (m.role === 'use_only' && USE_ONLY_BLOCKED.includes(action)) {
      await this.log(c.userId, 'blocked', v.id, it.id, { via: c.via, tried: action });
      throw new ForbiddenException('You can only use this login to sign in. Showing or copying the password is turned off for you.');
    }
    await this.log(c.userId, action, v.id, it.id, { via: c.via, ...(typeof b?.field === 'string' ? { field: b.field.slice(0, 30) } : {}) });
    return { ok: true };
  }

  /** history: a vault's (its managers; the Administrator for company vaults), one item's, or my own */
  async events(c: VaultCaller, vaultUid?: string, itemUid?: string) {
    let where: Prisma.VaultEventWhereInput;
    if (itemUid) {
      const it = await this.prisma.vaultItem.findUnique({ where: { uid: itemUid }, select: { id: true, vault: { select: { uid: true } } } });
      if (!it) throw new NotFoundException('Item not found.');
      await this.historyAccess(c.userId, it.vault.uid);
      where = { itemId: it.id };
    } else if (vaultUid) where = { vaultId: (await this.historyAccess(c.userId, vaultUid)).id };
    else where = { userId: c.userId };
    const rows = await this.prisma.vaultEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.userId, Number((r.meta as any)?.member) || 0]))] } }, select: USER_MINI });
    const items = await this.prisma.vaultItem.findMany({ where: { id: { in: rows.map((r) => r.itemId).filter((x): x is number => !!x) } }, select: { id: true, uid: true } });
    const vaults = await this.prisma.vault.findMany({ where: { id: { in: rows.map((r) => r.vaultId).filter((x): x is number => !!x) } }, select: { id: true, uid: true } });
    return rows.map((r) => ({ id: r.id, action: r.action, createdAt: r.createdAt, meta: r.meta, user: users.find((u) => u.id === r.userId) ?? null, member: users.find((u) => u.id === Number((r.meta as any)?.member)) ?? null, itemUid: items.find((i) => i.id === r.itemId)?.uid ?? null, vaultUid: vaults.find((x) => x.id === r.vaultId)?.uid ?? null }));
  }

  /** personal vault: only its owner; shared vault: its managers; company vault: also the Administrator */
  private async historyAccess(userId: number, vaultUid: string) {
    const v = await this.prisma.vault.findFirst({ where: { uid: String(vaultUid ?? ''), deletedAt: null } });
    if (!v) throw new NotFoundException('Vault not found.');
    const m = await this.prisma.vaultMember.findUnique({ where: { vaultId_userId: { vaultId: v.id, userId } } });
    if (m?.role === 'owner') return v;
    if (v.kind === 'shared' && v.companySource && (await this.isSuperAdmin(userId))) return v;
    if (m) throw new ForbiddenException('Only the vault’s managers can see its history.');
    throw new NotFoundException('Vault not found.');
  }

  // ───────── browser extension sign-in ─────────

  async tokens(c: VaultCaller) {
    if (c.via !== 'web') throw new ForbiddenException();
    return this.prisma.vaultToken.findMany({ where: { userId: c.userId, revokedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, createdAt: true, lastUsedAt: true } });
  }

  async createToken(c: VaultCaller, name?: string) {
    if (c.via !== 'web') throw new ForbiddenException('Connect a new extension from the web app.');
    if ((await this.prisma.vaultToken.count({ where: { userId: c.userId, revokedAt: null } })) >= 20) throw new BadRequestException('Too many connected browsers. Remove one first.');
    const token = `ezv_${randomBytes(32).toString('base64url')}`;
    const t = await this.prisma.vaultToken.create({ data: { userId: c.userId, tokenHash: createHash('sha256').update(token).digest('hex'), name: String(name ?? '').trim().slice(0, 80) || 'Browser extension' } });
    await this.log(c.userId, 'extension_connected', null, null, { token: t.id });
    return { id: t.id, token };
  }

  async revokeToken(c: VaultCaller, id: number) {
    const r = await this.prisma.vaultToken.updateMany({ where: { id, userId: c.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) throw new NotFoundException('Not found.');
    await this.log(c.userId, 'extension_removed', null, null, { token: id });
    return { ok: true };
  }

  /** the extension signs itself out */
  async signOutToken(authorization: string | undefined) {
    const m = /^Bearer (ezv_[A-Za-z0-9_-]{40,80})$/.exec(String(authorization ?? ''));
    if (m) await this.prisma.vaultToken.updateMany({ where: { tokenHash: createHash('sha256').update(m[1]).digest('hex'), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
}
