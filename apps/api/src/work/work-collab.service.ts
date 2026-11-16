import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationStreamService } from 'src/notifications/notification-stream.service';
import { WorkDocsService } from './work-docs.service';
import { WorkWhiteboardsService } from './work-whiteboards.service';

export type CollabKind = 'doc' | 'board';
type Peer = { userId: number; canEdit: boolean; at: number; checkedAt: number; awareness?: string };
type Room = {
  key: string; kind: CollabKind; id: number; uid: string;
  ydoc: Y.Doc;
  /** docs: the page has live content (from the database or a first editor's seed) */
  seeded: boolean;
  seeding: { clientId: string; at: number } | null;
  peers: Map<string, Peer>;
  dirty: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
};

const PEER_TTL = 45_000;
const SEED_TTL = 10_000;
const RECHECK = 120_000;
const MAX_UPDATE = 2_000_000;
const CLIENT = /^[A-Za-z0-9_-]{6,64}$/;
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

/**
 * Live co-editing for Work Docs and Whiteboards (Yjs). Each open page has a server copy of its
 * Yjs document; editors send their changes here, the server merges them and relays them to the
 * other people who have the page open over their notification stream (`work_chat`, type
 * `collab`). The merged state is saved to the page's yState column (debounced, and when the
 * last person leaves). Docs keep saving their HTML too (previews, search, the public view);
 * whiteboards keep saving their shapes JSON.
 */
@Injectable()
export class WorkCollabService implements OnModuleDestroy {
  private readonly rooms = new Map<string, Room>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
    private readonly docs: WorkDocsService,
    private readonly boards: WorkWhiteboardsService,
  ) {
    // someone saved the page outside the live editor (a plain content / shapes save): start the live copy over from it
    this.docs.onExternalEdit = (id) => void this.reset('doc', id);
    this.boards.onExternalEdit = (id) => void this.reset('board', id);
    this.sweeper = setInterval(() => void this.sweep(), 15_000);
    this.sweeper.unref?.();
  }

  async onModuleDestroy() {
    clearInterval(this.sweeper);
    for (const r of this.rooms.values()) await this.persist(r).catch(() => null);
  }

  /** access check through the page's own service; returns the row */
  private async target(kind: CollabKind, uid: string, userId: number) {
    if (kind === 'doc') {
      const d = await this.docs.forCollab(uid, userId);
      return { id: d.id, uid: d.uid, canEdit: d.canEdit, yState: d.yState as Uint8Array | null, shapes: null as any[] | null };
    }
    const b = await this.boards.forCollab(uid, userId);
    return { id: b.id, uid: b.uid, canEdit: b.canEdit, yState: b.yState as Uint8Array | null, shapes: Array.isArray((b.data as any)?.shapes) ? (b.data as any).shapes : [] };
  }

  private room(kind: CollabKind, t: { id: number; uid: string; yState: Uint8Array | null; shapes: any[] | null }) {
    const key = `${kind}:${t.id}`;
    let r = this.rooms.get(key);
    if (r) return r;
    const ydoc = new Y.Doc();
    let seeded = false;
    if (t.yState && t.yState.length) {
      try { Y.applyUpdate(ydoc, new Uint8Array(t.yState)); seeded = true; } catch { /* broken state: start over from the saved page */ }
    }
    if (!seeded && kind === 'board') {
      // whiteboards seed on the server: one map entry per shape (z keeps the stacking order)
      const m = ydoc.getMap<any>('shapes');
      ydoc.transact(() => (t.shapes ?? []).forEach((s, i) => m.set(String(s.id), { ...s, z: typeof s.z === 'number' ? s.z : i })));
      seeded = true;
    }
    r = { key, kind, id: t.id, uid: t.uid, ydoc, seeded, seeding: null, peers: new Map(), dirty: false, saveTimer: null };
    this.rooms.set(key, r);
    return r;
  }

  /** everyone with the page open except the sender's tab */
  private relay(r: Room, from: string, data: Record<string, unknown>) {
    const users = new Set<number>();
    for (const [cid, p] of r.peers) if (cid !== from) users.add(p.userId);
    for (const u of users) this.stream.emitRaw(u, 'work_chat', { type: 'collab', kind: r.kind, uid: r.uid, from, ...data });
  }

  private present(r: Room) {
    return [...r.peers.entries()].map(([clientId, p]) => ({ clientId, userId: p.userId, awareness: p.awareness ?? null }));
  }

  async join(kind: CollabKind, uid: string, userId: number, clientId: string) {
    if (!CLIENT.test(String(clientId ?? ''))) throw new BadRequestException('clientId is required.');
    const t = await this.target(kind, uid, userId);
    const r = this.room(kind, t);
    const now = Date.now();
    r.peers.set(clientId, { userId, canEdit: t.canEdit, at: now, checkedAt: now, awareness: r.peers.get(clientId)?.awareness });
    let seed = false;
    let wait = false;
    if (!r.seeded) {
      const s = r.seeding;
      if (s && s.clientId !== clientId && now - s.at < SEED_TTL && r.peers.has(s.clientId)) wait = true;
      else if (t.canEdit) { r.seeding = { clientId, at: now }; seed = true; }
      // a viewer of a page nobody has opened live yet sees the saved page (live: false)
    }
    return {
      state: r.seeded ? b64(Y.encodeStateAsUpdate(r.ydoc)) : null,
      seed, wait, live: r.seeded || seed || wait, canEdit: t.canEdit,
      peers: this.present(r).filter((p) => p.clientId !== clientId),
    };
  }

  private async peerOf(kind: CollabKind, uid: string, userId: number, clientId: string, edit: boolean) {
    const r = [...this.rooms.values()].find((x) => x.kind === kind && x.uid === uid);
    const p = r?.peers.get(String(clientId ?? ''));
    // not joined, or dropped after being idle: the editor joins again
    if (!r || !p || p.userId !== userId) throw new ConflictException('Join the page first.');
    const now = Date.now();
    if (now - p.checkedAt > RECHECK) {
      try { const t = await this.target(kind, uid, userId); p.canEdit = t.canEdit; p.checkedAt = now; }
      catch (e) { r.peers.delete(String(clientId)); throw e; }
    }
    if (edit && !p.canEdit) throw new NotFoundException('Not found.');
    p.at = now;
    return { r, p };
  }

  async update(kind: CollabKind, uid: string, userId: number, body: { clientId: string; update: string; seed?: boolean }) {
    const { r } = await this.peerOf(kind, uid, userId, body.clientId, true);
    const raw = String(body.update ?? '');
    if (!raw || raw.length > MAX_UPDATE * 1.4) throw new BadRequestException('Update is missing or too large.');
    const buf = new Uint8Array(Buffer.from(raw, 'base64'));
    if (!r.seeded && !(body.seed && r.seeding?.clientId === body.clientId)) throw new ConflictException('The page is still loading.');
    try { Y.applyUpdate(r.ydoc, buf); } catch { throw new BadRequestException('Bad update.'); }
    if (body.seed && !r.seeded) { r.seeded = true; r.seeding = null; }
    this.relay(r, body.clientId, { update: raw });
    this.schedule(r);
    return { ok: true };
  }

  /** cursor / name / color of one tab (y-protocols awareness update), relayed as is; also the heartbeat */
  async awareness(kind: CollabKind, uid: string, userId: number, body: { clientId: string; awareness: string }) {
    const { r, p } = await this.peerOf(kind, uid, userId, body.clientId, false);
    const a = String(body.awareness ?? '');
    if (a.length > 20_000) throw new BadRequestException('Too large.');
    if (a) { p.awareness = a; this.relay(r, body.clientId, { awareness: a }); }
    return { ok: true };
  }

  async leave(kind: CollabKind, uid: string, userId: number, body: { clientId: string; awareness?: string }) {
    const r = [...this.rooms.values()].find((x) => x.kind === kind && x.uid === uid);
    const p = r?.peers.get(String(body?.clientId ?? ''));
    if (!r || !p || p.userId !== userId) return { ok: true };
    r.peers.delete(body.clientId);
    if (r.seeding?.clientId === body.clientId) r.seeding = null;
    this.relay(r, body.clientId, { left: true, ...(body.awareness ? { awareness: String(body.awareness).slice(0, 20_000) } : {}) });
    if (!r.peers.size) await this.close(r);
    return { ok: true };
  }

  private schedule(r: Room) {
    r.dirty = true;
    if (r.saveTimer) return;
    r.saveTimer = setTimeout(() => { r.saveTimer = null; void this.persist(r).catch(() => null); }, 2000);
  }

  private async persist(r: Room) {
    if (r.saveTimer) { clearTimeout(r.saveTimer); r.saveTimer = null; }
    if (!r.dirty || !r.seeded) return;
    r.dirty = false;
    const yState = Buffer.from(Y.encodeStateAsUpdate(r.ydoc));
    if (r.kind === 'doc') await this.prisma.workDoc.update({ where: { id: r.id }, data: { yState } });
    else await this.prisma.workWhiteboard.update({ where: { id: r.id }, data: { yState } });
  }

  private async close(r: Room) {
    await this.persist(r).catch(() => null);
    if (!r.peers.size && this.rooms.get(r.key) === r) { this.rooms.delete(r.key); r.ydoc.destroy(); }
  }

  /** the page was saved outside the live editor: forget the live copy; open editors reload */
  private async reset(kind: CollabKind, id: number) {
    const key = `${kind}:${id}`;
    const r = this.rooms.get(key);
    if (r) {
      if (r.saveTimer) clearTimeout(r.saveTimer);
      this.rooms.delete(key);
      this.relay(r, '', { reset: true });
      r.ydoc.destroy();
    }
    if (kind === 'doc') await this.prisma.workDoc.update({ where: { id }, data: { yState: null } }).catch(() => null);
    else await this.prisma.workWhiteboard.update({ where: { id }, data: { yState: null } }).catch(() => null);
  }

  /** drop tabs that stopped sending heartbeats, and rooms nobody has open */
  private async sweep() {
    const now = Date.now();
    for (const r of [...this.rooms.values()]) {
      for (const [cid, p] of r.peers) if (now - p.at > PEER_TTL) { r.peers.delete(cid); this.relay(r, cid, { left: true }); }
      if (r.seeding && now - r.seeding.at > SEED_TTL) r.seeding = null;
      if (!r.peers.size) await this.close(r);
      else if (r.dirty && !r.saveTimer) await this.persist(r).catch(() => null);
    }
  }
}
