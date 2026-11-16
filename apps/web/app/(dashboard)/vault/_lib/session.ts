"use client";

/*
 * EZ Vault session: the unlocked keys and decrypted items live only in this tab's memory.
 * Reloading the page, locking or the idle timer drops them; nothing secret is written to storage.
 */

import { create } from "zustand";
import { api } from "@/lib/api";
import * as C from "@/lib/vault/vault-crypto";

export type ItemType = "login" | "note" | "card" | "identity";
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
};
export type Item = { uid: string; vaultUid: string; data: ItemData; keyVersion: number; createdAt: string; updatedAt: string; deletedAt: string | null; createdById: number; updatedById: number };
export type VaultRow = { uid: string; kind: "personal" | "shared"; name: string; role: "owner" | "editor" | "viewer"; keyVersion: number; members: number; items: number; key: CryptoKey };
export type Me = { user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }; via: string; setup: boolean; keys: C.StoredKeys | null };

type RawVault = { uid: string; kind: "personal" | "shared"; encName: string; keyVersion: number; role: VaultRow["role"]; encVaultKey: string; members: number; items: number };
type RawItem = Omit<Item, "data"> & { data: string };

export const vaultApi = {
  me: async () => (await api.get<Me>("/vault/me")).data,
  vaults: async () => (await api.get<RawVault[]>("/vault/vaults")).data,
  items: async (trash = false) => (await api.get<RawItem[]>("/vault/items", { params: trash ? { trash: 1 } : {} })).data,
  event: (itemUid: string, action: "viewed" | "revealed" | "copied" | "filled" | "exported", field?: string) => api.post("/vault/events", { itemUid, action, field }).catch(() => null),
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
      out.push({ uid: v.uid, kind: v.kind, role: v.role, keyVersion: v.keyVersion, members: v.members, items: v.items, key, name: v.kind === "personal" ? "Personal" : await C.decryptText(key, v.encName).catch(() => "Vault") });
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
    const { privateKey } = await C.unlockUserKeys(password, keys);
    await get().open(privateKey);
  },
  open: async (privateKey) => {
    set({ privateKey });
    const vaults = await openVaults(privateKey);
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

/**
 * Take someone out of a shared vault (or leave it): a new vault key for everyone who stays,
 * every item (trash too) re-encrypted with it, all switched over by the server in one go.
 */
export async function rekeyWithout(vaultUid: string, userId: number) {
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
  await api.post(`/vault/vaults/${vaultUid}/members/${userId}/remove`, { keyVersion: v.keyVersion + 1, members: keys, items });
}

export const typeLabel: Record<ItemType, string> = { login: "Login", note: "Secure note", card: "Card", identity: "Identity" };
export const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? (e?.message === "WRONG_PASSWORD" ? "That master password isn't right." : f);
