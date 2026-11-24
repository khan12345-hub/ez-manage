"use client";

/*
 * EZ Vault session: the unlocked keys and decrypted items live only in this tab's memory.
 * Reloading the page, locking or the idle timer drops them; nothing secret is written to storage.
 */

import { create } from "zustand";
import { api } from "@/lib/api";
import * as C from "@/lib/vault/vault-crypto";

export type ItemType = "login" | "passkey" | "note" | "card" | "identity";
export type ItemData = {
  type: ItemType;
  title: string;
  urls?: string[];
  username?: string;
  password?: string;
  totp?: string;
  notes?: string;
  favorite?: boolean;
  tags?: string[];
  passwordUpdatedAt?: string;
  card?: { holder?: string; number?: string; expiry?: string; cvv?: string; pin?: string };
  identity?: { fullName?: string; email?: string; phone?: string; address?: string; company?: string };
  /** a passkey (WebAuthn credential) stored here: the private key is encrypted like everything else */
  passkey?: { rpId?: string; username?: string; credentialId?: string; publicKey?: string; privateKey?: string; alg?: string; createdAt?: string };
};
export type Item = { uid: string; vaultUid: string; data: ItemData; keyVersion: number; createdAt: string; updatedAt: string; deletedAt: string | null; createdById: number; updatedById: number };
export type Role = "owner" | "editor" | "viewer" | "use_only";
export type Company = { source: "work" | "boards"; workspaceId: number; name: string };
export type VaultRow = { uid: string; kind: "personal" | "shared"; name: string; role: Role; keyVersion: number; members: number; items: number; key: CryptoKey; company: Company | null; needsRekey: boolean };
export type Me = {
  user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }; via: string; setup: boolean; keys: C.StoredKeys | null;
  isAdmin: boolean; isVaultAdmin: boolean;
  recovery: { enabled: boolean; version: number | null; publicKey: string | null; covered: boolean };
  recoveryRequest: { id: number; status: string; createdAt: string; expiresAt: string } | null;
};
/** what each role may do (owner is called "Manager" in the app) */
export const ROLE_LABEL: Record<Role, string> = { owner: "Manager", editor: "Editor", viewer: "Viewer", use_only: "Use only" };
export const ROLE_HINT: Record<Role, string> = {
  owner: "Adds and removes people, edits items",
  editor: "Adds and edits items",
  viewer: "Sees and copies items",
  use_only: "Signs in with the extension; can't show or copy passwords",
};
export const canWrite = (r?: Role) => r === "owner" || r === "editor";
export const canReveal = (r?: Role) => r !== "use_only";

type RawVault = { uid: string; kind: "personal" | "shared"; encName: string; keyVersion: number; role: Role; encVaultKey: string; members: number; items: number; company: Company | null; needsRekey: boolean };
type RawItem = Omit<Item, "data"> & { data: string };

export const vaultApi = {
  me: async () => (await api.get<Me>("/vault/me")).data,
  vaults: async () => (await api.get<RawVault[]>("/vault/vaults")).data,
  items: async (trash = false) => (await api.get<RawItem[]>("/vault/items", { params: trash ? { trash: 1 } : {} })).data,
  event: (itemUid: string, action: "viewed" | "revealed" | "copied" | "filled" | "exported", field?: string) => api.post("/vault/events", { itemUid, action, field }).catch(() => null),
  /** a role check that must pass before showing / copying (refused for "use only") */
  allow: async (itemUid: string, action: "revealed" | "copied" | "exported", field?: string) => { await api.post("/vault/events", { itemUid, action, field }); },
};

const LOCK_KEY = "ez:vault:lock-minutes";
export const lockMinutes = () => { try { return Math.max(1, Math.min(240, Number(localStorage.getItem(LOCK_KEY)) || 15)); } catch { return 15; } };
export const setLockMinutes = (m: number) => { try { localStorage.setItem(LOCK_KEY, String(m)); } catch {} };

type State = {
  me: Me | null;
  privateKey: CryptoKey | null;
  vaults: VaultRow[];
  items: Item[];
  trash: Item[];
  /** items we couldn't open (key changed under us) */
  broken: number;
  unlocked: boolean;
  setMe: (m: Me) => void;
  unlock: (password: string) => Promise<void>;
  /** after setup: we already hold the private key */
  open: (privateKey: CryptoKey) => Promise<void>;
  reload: () => Promise<void>;
  lock: () => void;
};

async function openVaults(privateKey: CryptoKey) {
  const raw = await vaultApi.vaults();
  const out: VaultRow[] = [];
  for (const v of raw) {
    try {
      const key = await C.unwrapVaultKey(v.encVaultKey, privateKey);
      out.push({ uid: v.uid, kind: v.kind, role: v.role, keyVersion: v.keyVersion, members: v.members, items: v.items, key, company: v.company ?? null, needsRekey: !!v.needsRekey, name: v.kind === "personal" ? "Personal" : await C.decryptText(key, v.encName).catch(() => "Vault") });
    } catch { /* a vault whose key we can't open is skipped */ }
  }
  return out.sort((a, b) => (a.kind === "personal" ? -1 : b.kind === "personal" ? 1 : a.name.localeCompare(b.name)));
}

async function openItems(raw: RawItem[], vaults: VaultRow[]) {
  const out: Item[] = [];
  let broken = 0;
  for (const r of raw) {
    const v = vaults.find((x) => x.uid === r.vaultUid);
    if (!v) continue;
    try { out.push({ ...r, data: await C.decryptJson<ItemData>(v.key, r.data) }); } catch { broken++; }
  }
  return { items: out, broken };
}

export const useVault = create<State>((set, get) => ({
  me: null, privateKey: null, vaults: [], items: [], trash: [], broken: 0, unlocked: false,
  setMe: (me) => set({ me }),
  unlock: async (password) => {
    const keys = get().me?.keys;
    if (!keys) throw new Error("NOT_SETUP");
    const { privateKey, pkcs8 } = await C.unlockUserKeys(password, keys);
    await get().open(privateKey);
    // admin recovery: make sure this vault can be recovered with the current organisation key
    const r = get().me?.recovery;
    if (r?.enabled && !r.covered && r.publicKey) {
      try { await api.post("/vault/recovery/wrap", { ...(await C.wrapForRecovery(pkcs8, r.publicKey)), version: r.version }); set({ me: { ...get().me!, recovery: { ...r, covered: true } } }); } catch { /* next unlock */ }
    }
  },
  open: async (privateKey) => {
    set({ privateKey });
    let vaults = await openVaults(privateKey);
    // someone was taken out of a vault without a new key (e.g. disabled): as its manager, re-key it now
    const stale = vaults.filter((v) => v.needsRekey && v.role === "owner");
    if (stale.length) {
      useVault.setState({ vaults });
      for (const v of stale) await rekeyWithout(v.uid, null).catch(() => null);
      vaults = await openVaults(privateKey);
    }
    const [a, t] = await Promise.all([vaultApi.items(), vaultApi.items(true)]);
    const live = await openItems(a, vaults);
    const dead = await openItems(t, vaults);
    set({ vaults, items: live.items, trash: dead.items, broken: live.broken, unlocked: true });
  },
  reload: async () => {
    const pk = get().privateKey;
    if (pk) await get().open(pk);
  },
  lock: () => set({ privateKey: null, vaults: [], items: [], trash: [], broken: 0, unlocked: false }),
}));

export const vaultOf = (uid: string) => useVault.getState().vaults.find((v) => v.uid === uid);

/** save a new item into a vault */
export async function createItem(vaultUid: string, data: ItemData) {
  const v = vaultOf(vaultUid)!;
  const r = (await api.post<{ uid: string }>(`/vault/vaults/${vaultUid}/items`, { data: await C.encryptJson(v.key, data), keyVersion: v.keyVersion })).data;
  await useVault.getState().reload();
  return r.uid;
}
/** save changes (or move to another vault: re-encrypted with that vault's key) */
export async function updateItem(item: Item, data: ItemData, toVault?: string) {
  const target = vaultOf(toVault ?? item.vaultUid)!;
  await api.patch(`/vault/items/${item.uid}`, { data: await C.encryptJson(target.key, data), keyVersion: target.keyVersion, ...(toVault && toVault !== item.vaultUid ? { vaultUid: toVault } : {}) });
  await useVault.getState().reload();
}

/** the same login (username + overlapping website) in OTHER vaults the user can write to — matched in the browser */
export function sameLoginElsewhere(item: Item | null, data: ItemData) {
  const uname = (data.username ?? "").trim().toLowerCase();
  if (data.type !== "login" || !uname) return [] as Item[];
  const urls = (data.urls ?? []).filter(Boolean);
  const st = useVault.getState();
  return st.items.filter((i) =>
    i.uid !== item?.uid &&
    i.data.type === "login" &&
    (i.data.username ?? "").trim().toLowerCase() === uname &&
    canWrite(vaultOf(i.vaultUid)?.role) &&
    (i.data.urls ?? []).some((u) => urls.some((s) => C.sameSite(u, s))),
  );
}

/**
 * Save the edited login AND push its new password to the same login wherever else the user can
 * write it (shared vaults they manage) — all re-encrypted in the browser under each vault's own key.
 * Zero-knowledge holds: only vaults whose key is already unlocked here are touched; copies in vaults
 * we can't open (e.g. someone else's personal vault) are never seen and can't be reached.
 */
export async function updateItemEverywhere(item: Item, data: ItemData, toVault?: string) {
  const matches = sameLoginElsewhere(item, data);
  await updateItem(item, data, toVault);
  const affected = new Set<string>();
  for (const m of matches) {
    const v = vaultOf(m.vaultUid);
    if (!v || !canWrite(v.role)) continue;
    const nd: ItemData = { ...m.data, password: data.password, passwordUpdatedAt: new Date().toISOString() };
    try {
      await api.patch(`/vault/items/${m.uid}`, { data: await C.encryptJson(v.key, nd), keyVersion: v.keyVersion });
      affected.add(m.vaultUid);
    } catch { /* a vault whose key moved under us is skipped; the user can retry */ }
  }
  if (affected.size) {
    await useVault.getState().reload();
    await api.post(`/vault/password-updated`, { vaultUids: [...affected] }).catch(() => null);
  }
  return { updated: affected.size };
}

/**
 * Take someone out of a shared vault (or leave it): a new vault key for everyone who stays,
 * every item (trash too) re-encrypted with it, all switched over by the server in one go.
 */
export async function rekeyWithout(vaultUid: string, userId: number | null) {
  const v = vaultOf(vaultUid)!;
  const members = (await api.get<{ user: { id: number } | null; publicKey: string | null }[]>(`/vault/vaults/${vaultUid}/members`)).data;
  const stay = members.filter((m) => m.user && m.user.id !== userId);
  const fresh = await C.newVaultKey();
  const keys = [] as { userId: number; encVaultKey: string }[];
  for (const m of stay) {
    if (!m.publicKey) throw new Error("A member has no key.");
    keys.push({ userId: m.user!.id, encVaultKey: await C.wrapVaultKey(fresh, m.publicKey) });
  }
  const [a, t] = await Promise.all([vaultApi.items(), vaultApi.items(true)]);
  const items = [] as { uid: string; data: string }[];
  for (const r of [...a, ...t].filter((x) => x.vaultUid === vaultUid)) {
    items.push({ uid: r.uid, data: await C.encryptBytes(fresh, await C.decryptBytes(v.key, r.data)) });
  }
  // the name is encrypted with the vault key as well, so it moves to the new key too
  const encName = await C.encryptText(fresh, v.name);
  if (userId === null) await api.post(`/vault/vaults/${vaultUid}/rekey`, { keyVersion: v.keyVersion + 1, members: keys, items, encName });
  else await api.post(`/vault/vaults/${vaultUid}/members/${userId}/remove`, { keyVersion: v.keyVersion + 1, members: keys, items, encName });
}

// ───────── admin recovery: the one-time key for a request stays in this browser (IndexedDB, not extractable) ─────────

const IDB = "ez-vault-recovery";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function saveRequestKey(userId: number, key: CryptoKey) {
  const db = await idb();
  await new Promise<void>((res, rej) => { const t = db.transaction("keys", "readwrite"); t.objectStore("keys").put(key, `u${userId}`); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
export async function loadRequestKey(userId: number): Promise<CryptoKey | null> {
  try {
    const db = await idb();
    return await new Promise((res) => { const t = db.transaction("keys", "readonly"); const g = t.objectStore("keys").get(`u${userId}`); g.onsuccess = () => res((g.result as CryptoKey) ?? null); g.onerror = () => res(null); });
  } catch { return null; }
}
export async function dropRequestKey(userId: number) {
  try { const db = await idb(); db.transaction("keys", "readwrite").objectStore("keys").delete(`u${userId}`); } catch { /* nothing to drop */ }
}

export const typeLabel: Record<ItemType, string> = { login: "Login", passkey: "Passkey", note: "Secure note", card: "Card", identity: "Identity" };
export const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? (e?.message === "WRONG_PASSWORD" ? "That master password isn't right." : f);
