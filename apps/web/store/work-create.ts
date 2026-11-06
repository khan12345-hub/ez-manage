"use client";

import { create } from "zustand";

/** Open state of Work's Create panel (+), optionally preselecting a list. */
interface WorkCreateStore {
  open: boolean;
  listUid: string | null;
  openCreate: (listUid?: string | null) => void;
  setOpen: (open: boolean) => void;
}

export const useWorkCreate = create<WorkCreateStore>((set) => ({
  open: false,
  listUid: null,
  openCreate: (listUid = null) => set({ open: true, listUid }),
  setOpen: (open) => set({ open }),
}));

const recentKey = (ws: string) => `ez:work:recentLists:${ws}`;

export function getRecentLists(ws: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(ws)) ?? "[]");
  } catch {
    return [];
  }
}

export function pushRecentList(ws: string, uid: string) {
  try {
    const next = [uid, ...getRecentLists(ws).filter((u) => u !== uid)].slice(0, 5);
    localStorage.setItem(recentKey(ws), JSON.stringify(next));
  } catch {}
}
