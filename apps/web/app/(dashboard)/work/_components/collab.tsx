"use client";

/*
 * Live co-editing for Work Docs and Whiteboards: a small Yjs "provider" that talks to the API
 * (POST /work/{docs|whiteboards}/:uid/collab/*) and gets other people's changes over the
 * notification stream (WORK_CHAT_EVENT, type "collab").
 */

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { api } from "@/lib/api";
import { WORK_CHAT_EVENT } from "@/services/notifications.sse";

export type CollabUser = { id: number; name: string; color: string; avatarUrl?: string | null };
type CollabEvent = { type: "collab"; kind: "doc" | "board"; uid: string; from: string; update?: string; awareness?: string; reset?: boolean; left?: boolean };
type JoinResult = { state: string | null; seed: boolean; wait: boolean; live: boolean; canEdit: boolean };

const COLORS = ["#2563EB", "#DB2777", "#EA580C", "#7C3AED", "#0D9488", "#CA8A04", "#DC2626", "#4F46E5", "#059669"];
export const colorFor = (id: number) => COLORS[Math.abs(id) % COLORS.length]!;

const toB64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const REMOTE = "remote";

export class LiveRoom {
  readonly ydoc = new Y.Doc();
  readonly awareness = new Awareness(this.ydoc);
  readonly clientId = `c${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
  /** called when the page was replaced outside the live editor: reload it */
  onReset: (() => void) | null = null;
  private queue: Uint8Array[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private seeding = false;
  private destroyed = false;
  private awTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly base: string;
  private readonly kind: "doc" | "board";

  constructor(kind: "docs" | "whiteboards", private readonly uid: string, user: CollabUser) {
    this.base = `/work/${kind}/${uid}/collab`;
    this.kind = kind === "docs" ? "doc" : "board";
    this.awareness.setLocalStateField("user", user);
    this.ydoc.on("update", this.onLocalUpdate);
    this.awareness.on("update", this.onAwareness);
    window.addEventListener(WORK_CHAT_EVENT, this.onEvent);
    window.addEventListener("pagehide", this.onPageHide);
  }

  /** join the page; waits while another editor loads a page that isn't live yet */
  async start(): Promise<JoinResult> {
    for (let i = 0; ; i++) {
      const r = (await api.post<JoinResult>(`${this.base}/join`, { clientId: this.clientId })).data;
      if (r.state) Y.applyUpdate(this.ydoc, fromB64(r.state), REMOTE);
      if (!r.wait || i >= 15) {
        this.seeding = r.seed;
        this.sendAwareness(true);
        return r;
      }
      await new Promise((res) => setTimeout(res, 700));
      if (this.destroyed) return r;
    }
  }

  /** after a first editor filled the page from its saved copy: send it all as the starting point */
  async seedDone() {
    if (!this.seeding) return;
    this.queue = [];
    await api.post(`${this.base}/update`, { clientId: this.clientId, update: toB64(Y.encodeStateAsUpdate(this.ydoc)), seed: true });
    this.seeding = false;
  }

  private onLocalUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || this.destroyed) return;
    this.queue.push(u);
    if (!this.flushTimer && !this.seeding) this.flushTimer = setTimeout(this.flush, 60);
  };

  private flush = async () => {
    this.flushTimer = null;
    if (this.sending || !this.queue.length || this.seeding) return;
    const update = this.queue.length === 1 ? this.queue[0]! : Y.mergeUpdates(this.queue);
    this.queue = [];
    this.sending = true;
    try {
      await api.post(`${this.base}/update`, { clientId: this.clientId, update: toB64(update) });
    } catch (e: any) {
      if (e?.response?.status === 409 && !this.destroyed) {
        // dropped after being idle: join again, then send the change again (Yjs ignores repeats)
        try { await this.start(); await api.post(`${this.base}/update`, { clientId: this.clientId, update: toB64(update) }); }
        catch { this.queue.unshift(update); }
      } else if (!this.destroyed && (!e?.response || e.response.status >= 500)) {
        this.queue.unshift(update); // network hiccup: try again
      }
    } finally {
      this.sending = false;
      if (this.queue.length && !this.flushTimer && !this.destroyed) this.flushTimer = setTimeout(this.flush, 300);
    }
  };

  private onAwareness = (_: unknown, origin: unknown) => {
    if (origin === REMOTE) return;
    this.sendAwareness(false);
  };

  private sendAwareness(now: boolean) {
    if (this.destroyed || this.awTimer) return;
    const send = () => {
      this.awTimer = null;
      if (this.destroyed) return;
      void api.post(`${this.base}/awareness`, { clientId: this.clientId, awareness: toB64(encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID])) }).catch(() => null);
    };
    if (now) send();
    else this.awTimer = setTimeout(send, 120);
  }

  private onEvent = (ev: Event) => {
    const e = (ev as CustomEvent<CollabEvent>).detail;
    if (e?.type !== "collab" || e.kind !== this.kind || e.uid !== this.uid || e.from === this.clientId || this.destroyed) return;
    if (e.reset) { this.onReset?.(); return; }
    try {
      if (e.update) Y.applyUpdate(this.ydoc, fromB64(e.update), REMOTE);
      if (e.awareness) applyAwarenessUpdate(this.awareness, fromB64(e.awareness), REMOTE);
    } catch { /* a broken message: ignore */ }
  };

  private onPageHide = () => { void this.leave(); };

  private async leave() {
    removeAwarenessStates(this.awareness, [this.ydoc.clientID], "local");
    const awareness = toB64(encodeAwarenessUpdate(this.awareness, [this.ydoc.clientID]));
    await api.post(`${this.base}/leave`, { clientId: this.clientId, awareness }).catch(() => null);
  }

  async destroy() {
    if (this.destroyed) return;
    // last changes first
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (this.queue.length && !this.seeding) await this.flush();
    this.destroyed = true;
    window.removeEventListener(WORK_CHAT_EVENT, this.onEvent);
    window.removeEventListener("pagehide", this.onPageHide);
    if (this.awTimer) clearTimeout(this.awTimer);
    await this.leave();
    this.awareness.destroy();
    this.ydoc.off("update", this.onLocalUpdate);
  }
}

/** the other people who have the page open (one entry per person) */
export function usePeers(room: LiveRoom | null) {
  const [peers, setPeers] = useState<(CollabUser & { pointer?: { x: number; y: number } })[]>([]);
  useEffect(() => {
    if (!room) { setPeers([]); return; }
    const read = () => {
      const seen = new Map<number, CollabUser & { pointer?: { x: number; y: number } }>();
      room.awareness.getStates().forEach((s, cid) => {
        if (cid === room.ydoc.clientID || !s?.user) return;
        const u = s.user as CollabUser;
        seen.set(cid, { ...u, pointer: s.pointer });
      });
      setPeers([...seen.values()]);
    };
    read();
    room.awareness.on("change", read);
    return () => room.awareness.off("change", read);
  }, [room]);
  return peers;
}

/** a row of small avatars: who else is here */
export function PeersBar({ peers, meId }: { peers: CollabUser[]; meId?: number }) {
  const unique = [...new Map(peers.filter((p) => p.id !== meId).map((p) => [p.id, p])).values()];
  if (!unique.length) return null;
  return (
    <span className="flex items-center gap-1.5" aria-label={`Also here: ${unique.map((p) => p.name).join(", ")}`}>
      <span className="text-[11.5px] text-muted-foreground">Live</span>
      <span className="flex -space-x-1.5">
        {unique.slice(0, 5).map((p) => (
          <span key={p.id} title={`${p.name} is here`} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold text-white ring-2 ring-background" style={{ background: p.color }}>
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        ))}
      </span>
      {unique.length > 5 && <span className="text-[11px] text-muted-foreground">+{unique.length - 5}</span>}
    </span>
  );
}
