import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import type { VaultCaller } from './vault.guard';

const USER_MINI = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } as const;
const uid = () => randomBytes(9).toString('base64url');
const ROLES = ['owner', 'editor', 'viewer'] as const;
type Role = (typeof ROLES)[number];
const CLIENT_EVENTS = ['viewed', 'revealed', 'copied', 'filled', 'exported'] as const;

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
  constructor(private readonly prisma: PrismaService) {}

  // ───────── setup & master password ─────────

  async me(c: VaultCaller) {
    const [u, keys] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: c.userId }, select: USER_MINI }),
      this.prisma.vaultUser.findUnique({ where: { userId: c.userId } }),
    ]);
    return { user: u, via: c.via, setup: !!keys, keys: keys ? { salt: keys.salt, iterations: keys.iterations, publicKey: keys.publicKey, encPrivateKey: keys.encPrivateKey, verifier: keys.verifier } : null };
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
    await this.prisma.$transaction(async (tx) => {
      await tx.vaultUser.create({ data: { userId: c.userId, ...f, publicKey } });
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
   * Forgot the master password: nothing can be decrypted any more, so start over. Personal items
   * are deleted, shared vaults lose this person (others keep them), extension sign-ins end.
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
          // keep at least one owner
          if (!(await tx.vaultMember.count({ where: { vaultId: m.vaultId, role: 'owner' } }))) {
            const next = await tx.vaultMember.findFirst({ where: { vaultId: m.vaultId }, orderBy: { createdAt: 'asc' } });
            if (next) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: next.vaultId, userId: next.userId } }, data: { role: 'owner' } });
          }
        }
      }
      await tx.vaultUser.delete({ where: { userId: c.userId } }).catch(() => null);
      await tx.vaultToken.updateMany({ where: { userId: c.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.log(c.userId, 'reset', null, null);
    return { ok: true };
  }

  // ───────── vaults ─────────

  private async member(vaultUid: string, userId: number, need: 'read' | 'write' | 'owner') {
    const v = await this.prisma.vault.findFirst({ where: { uid: String(vaultUid ?? ''), deletedAt: null } });
    if (!v) throw new NotFoundException('Vault not found.');
    const m = await this.prisma.vaultMember.findUnique({ where: { vaultId_userId: { vaultId: v.id, userId } } });
    if (!m) throw new NotFoundException('Vault not found.');
    if (need === 'write' && m.role === 'viewer') throw new ForbiddenException('You can only view this vault.');
    if (need === 'owner' && m.role !== 'owner') throw new ForbiddenException('Only the vault owner can do this.');
    return { v, m };
  }

  async vaults(c: VaultCaller) {
    const rows = await this.prisma.vaultMember.findMany({
      where: { userId: c.userId, vault: { deletedAt: null } },
      select: { role: true, encVaultKey: true, keyVersion: true, vault: { select: { id: true, uid: true, kind: true, encName: true, keyVersion: true, createdById: true, createdAt: true, _count: { select: { members: true, items: { where: { deletedAt: null } } } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ uid: r.vault.uid, kind: r.vault.kind, encName: r.vault.encName, keyVersion: r.vault.keyVersion, role: r.role, encVaultKey: r.encVaultKey, memberKeyVersion: r.keyVersion, members: r.vault._count.members, items: r.vault._count.items, createdById: r.vault.createdById, createdAt: r.vault.createdAt }));
  }

  async createVault(c: VaultCaller, b: any) {
    if (!(await this.prisma.vaultUser.findUnique({ where: { userId: c.userId }, select: { userId: true } }))) throw new BadRequestException('Set up EZ Vault first.');
    const v = await this.prisma.vault.create({ data: { uid: uid(), kind: 'shared', encName: blob(b?.encName, 'vault name', 2_000), createdById: c.userId } });
    await this.prisma.vaultMember.create({ data: { vaultId: v.id, userId: c.userId, role: 'owner', encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), addedById: c.userId } });
    await this.log(c.userId, 'vault_created', v.id, null, { via: c.via });
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
    const it = await this.prisma.vaultItem.create({ data: { uid: uid(), vaultId: v.id, data: blob(b?.data, 'item'), keyVersion: v.keyVersion, createdById: c.userId, updatedById: c.userId }, select: this.shapeItem });
    await this.log(c.userId, 'created', v.id, (await this.prisma.vaultItem.findUnique({ where: { uid: it.uid }, select: { id: true } }))!.id, { via: c.via });
    const { vault, ...r } = it;
    return { ...r, vaultUid: vault.uid };
  }

  private async itemOf(itemUid: string, userId: number, need: 'read' | 'write') {
    const it = await this.prisma.vaultItem.findUnique({ where: { uid: String(itemUid ?? '') }, select: { id: true, vaultId: true, deletedAt: true, vault: { select: { uid: true } } } });
    if (!it) throw new NotFoundException('Item not found.');
    const { v } = await this.member(it.vault.uid, userId, need);
    return { it, v };
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

  /** people in my Boards / Work companies (with their public key once they've set up EZ Vault) */
  async people(c: VaultCaller, q?: string) {
    const [b, w] = await Promise.all([
      this.prisma.workspaceMember.findMany({ where: { userId: c.userId, deletedAt: null }, select: { workspaceId: true } }),
      this.prisma.workMember.findMany({ where: { userId: c.userId }, select: { workspaceId: true } }),
    ]);
    const ids = new Set<number>();
    if (b.length) (await this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: b.map((x) => x.workspaceId) }, deletedAt: null }, select: { userId: true } })).forEach((x) => ids.add(x.userId));
    if (w.length) (await this.prisma.workMember.findMany({ where: { workspaceId: { in: w.map((x) => x.workspaceId) } }, select: { userId: true } })).forEach((x) => ids.add(x.userId));
    ids.delete(c.userId);
    const term = String(q ?? '').trim();
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, deletedAt: null, ...(term ? { OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {}) },
      select: USER_MINI, take: 50, orderBy: { firstName: 'asc' },
    });
    const keys = await this.prisma.vaultUser.findMany({ where: { userId: { in: users.map((u) => u.id) } }, select: { userId: true, publicKey: true } });
    return users.map((u) => ({ ...u, publicKey: keys.find((k) => k.userId === u.id)?.publicKey ?? null }));
  }

  private async canShareWith(ownerId: number, userId: number) {
    const ok = (await this.people({ userId: ownerId, via: 'web' })).find((p) => p.id === userId);
    if (!ok) throw new BadRequestException('You can only share with people in your companies.');
    if (!ok.publicKey) throw new BadRequestException(`${ok.firstName} hasn’t set up EZ Vault yet.`);
    return ok;
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
    await this.canShareWith(c.userId, userId);
    if (Number(b?.keyVersion) !== v.keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    await this.prisma.vaultMember.upsert({
      where: { vaultId_userId: { vaultId: v.id, userId } },
      create: { vaultId: v.id, userId, role, encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), keyVersion: v.keyVersion, addedById: c.userId },
      update: { role, encVaultKey: blob(b?.encVaultKey, 'vault key', 5_000), keyVersion: v.keyVersion },
    });
    await this.log(c.userId, 'member_added', v.id, null, { member: userId, role });
    return { ok: true };
  }

  async setRole(c: VaultCaller, vaultUid: string, userId: number, role: string) {
    const { v } = await this.member(vaultUid, c.userId, 'owner');
    if (!ROLES.includes(role as Role)) throw new BadRequestException('Unknown role.');
    if (userId === c.userId && role !== 'owner' && (await this.prisma.vaultMember.count({ where: { vaultId: v.id, role: 'owner' } })) < 2) throw new BadRequestException('A vault needs at least one owner.');
    const r = await this.prisma.vaultMember.updateMany({ where: { vaultId: v.id, userId }, data: { role } });
    if (!r.count) throw new NotFoundException('Not a member.');
    await this.log(c.userId, 'member_role', v.id, null, { member: userId, role });
    return { ok: true };
  }

  /**
   * Remove someone. They may have seen the old key, so the browser sends a fresh key for everyone
   * who stays and every item re-encrypted with it; it all switches over in one go.
   */
  async removeMember(c: VaultCaller, vaultUid: string, userId: number, b: any) {
    const leaving = userId === c.userId;
    const { v } = await this.member(vaultUid, c.userId, leaving ? 'read' : 'owner');
    if (v.kind === 'personal') throw new BadRequestException('Not possible for a personal vault.');
    const members = await this.prisma.vaultMember.findMany({ where: { vaultId: v.id }, select: { userId: true, role: true } });
    if (!members.some((m) => m.userId === userId)) throw new NotFoundException('Not a member.');
    const stay = members.filter((m) => m.userId !== userId);
    if (!stay.length) throw new BadRequestException('You are the last member. Delete the vault instead.');
    const keyVersion = v.keyVersion + 1;
    // leaving on your own: no re-key from you (you can't wrap for others' keys? you can: all public); still required
    const keys: { userId: number; encVaultKey: string }[] = Array.isArray(b?.members) ? b.members : [];
    const items: { uid: string; data: string }[] = Array.isArray(b?.items) ? b.items : [];
    if (Number(b?.keyVersion) !== keyVersion) throw new BadRequestException('This vault’s key changed. Reload and try again.');
    const want = new Set(stay.map((m) => m.userId));
    if (keys.length !== want.size || !keys.every((k) => want.has(Number(k.userId)))) throw new BadRequestException('A new key is needed for everyone who stays.');
    const all = await this.prisma.vaultItem.findMany({ where: { vaultId: v.id }, select: { id: true, uid: true } });
    const byUid = new Map(items.map((i) => [String(i.uid), i.data]));
    if (all.length !== items.length || !all.every((i) => byUid.has(i.uid))) throw new BadRequestException('Every item must be re-encrypted. Reload and try again.');
    await this.prisma.$transaction(async (tx) => {
      await tx.vaultMember.delete({ where: { vaultId_userId: { vaultId: v.id, userId } } });
      for (const k of keys) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: v.id, userId: Number(k.userId) } }, data: { encVaultKey: blob(k.encVaultKey, 'vault key', 5_000), keyVersion } });
      for (const i of all) await tx.vaultItem.update({ where: { id: i.id }, data: { data: blob(byUid.get(i.uid), 'item'), keyVersion } });
      await tx.vault.update({ where: { id: v.id }, data: { keyVersion } });
      if (!stay.some((m) => m.role === 'owner')) await tx.vaultMember.update({ where: { vaultId_userId: { vaultId: v.id, userId: stay[0].userId } }, data: { role: 'owner' } });
    }, { timeout: 60_000 });
    await this.log(c.userId, leaving ? 'left' : 'member_removed', v.id, null, { member: userId });
    return { ok: true, keyVersion };
  }

  // ───────── activity ─────────

  async log(userId: number, action: string, vaultId: number | null, itemId: number | null, meta?: Record<string, unknown>) {
    await this.prisma.vaultEvent.create({ data: { userId, action, vaultId, itemId, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined } }).catch(() => null);
  }

  /** the browser tells us when a secret was viewed / copied / filled */
  async clientEvent(c: VaultCaller, b: any) {
    const action = String(b?.action ?? '');
    if (!(CLIENT_EVENTS as readonly string[]).includes(action)) throw new BadRequestException('Unknown event.');
    const { it, v } = await this.itemOf(String(b?.itemUid ?? ''), c.userId, 'read');
    await this.log(c.userId, action, v.id, it.id, { via: c.via, ...(typeof b?.field === 'string' ? { field: b.field.slice(0, 30) } : {}) });
    return { ok: true };
  }

  /** a vault's log (everyone in it), or my own log */
  async events(c: VaultCaller, vaultUid?: string) {
    let where: Prisma.VaultEventWhereInput;
    if (vaultUid) { const { v } = await this.member(vaultUid, c.userId, 'read'); where = { vaultId: v.id }; }
    else where = { userId: c.userId };
    const rows = await this.prisma.vaultEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.userId, Number((r.meta as any)?.member) || 0]))] } }, select: USER_MINI });
    const items = await this.prisma.vaultItem.findMany({ where: { id: { in: rows.map((r) => r.itemId).filter((x): x is number => !!x) } }, select: { id: true, uid: true } });
    const vaults = await this.prisma.vault.findMany({ where: { id: { in: rows.map((r) => r.vaultId).filter((x): x is number => !!x) } }, select: { id: true, uid: true } });
    return rows.map((r) => ({ id: r.id, action: r.action, createdAt: r.createdAt, meta: r.meta, user: users.find((u) => u.id === r.userId) ?? null, member: users.find((u) => u.id === Number((r.meta as any)?.member)) ?? null, itemUid: items.find((i) => i.id === r.itemId)?.uid ?? null, vaultUid: vaults.find((x) => x.id === r.vaultId)?.uid ?? null }));
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
