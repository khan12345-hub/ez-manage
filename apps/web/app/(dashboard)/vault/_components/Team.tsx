"use client";

/* Vault managers: one item's history, and "Passwords to change" after someone left a vault. */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, History } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { errMsg, useVault } from "../_lib/session";
import { ago } from "./bits";

type Ev = { id: number; action: string; createdAt: string; meta: any; user: { firstName: string; lastName: string } | null };
const SAID: Record<string, string> = {
  created: "added it", updated: "edited it", moved: "moved it", deleted: "moved it to the trash", restored: "restored it",
  viewed: "opened it", revealed: "showed a secret", copied: "copied a secret", filled: "signed in with it", exported: "exported it",
  blocked: "was stopped from showing / copying it", password_changed_marked: "marked its password as changed",
};

/** who opened / copied / filled this item (managers only) */
export function ItemHistory({ itemUid }: { itemUid: string }) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "events", "item", itemUid], queryFn: async () => (await api.get<Ev[]>("/vault/events", { params: { item: itemUid } })).data, enabled: open });
  return (
    <section className="mt-4 rounded-xl border border-border bg-card">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold">
        <History className="h-4 w-4 text-product-vault" /> History of this item
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        isLoading ? <div className="mx-4 mb-3 h-16 animate-pulse rounded-lg bg-muted" /> : !data.length ? <p className="px-4 pb-3 text-[12.5px] text-muted-foreground">Nothing recorded yet.</p> : (
          <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto border-t border-border">
            {data.map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-4 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1"><strong className="font-semibold">{e.user ? `${e.user.firstName} ${e.user.lastName}` : "Someone"}</strong> {SAID[e.action] ?? e.action}{e.meta?.via === "extension" && <span className="ml-1.5 rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">extension</span>}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ago(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

type Rot = { id: number; removedAt: string; removed: { firstName: string; lastName: string } | null; by: { firstName: string; lastName: string } | null; items: { itemId: number; itemUid: string | null; gone: boolean; seen: string[]; resolved: boolean; editedSince: boolean }[] };

/** after someone left / was removed: the passwords they could open, to be changed */
export function RotationsPanel({ vaultUid, onOpen }: { vaultUid: string; onOpen: (itemUid: string) => void }) {
  const qc = useQueryClient();
  const items = useVault((s) => s.items);
  const { data = [] } = useQuery({ queryKey: ["vault", "rotations", vaultUid], queryFn: async () => (await api.get<Rot[]>(`/vault/vaults/${vaultUid}/rotations`)).data });
  const [open, setOpen] = useState(false);
  const todo = data.flatMap((r) => r.items.filter((i) => !i.resolved && !i.gone).map((i) => ({ ...i, rot: r })));
  if (!todo.length) return null;
  const title = (uid: string | null) => items.find((i) => i.uid === uid)?.data.title ?? "An item";
  const mark = async (rotId: number, itemId: number) => {
    try { await api.patch(`/vault/rotations/${rotId}`, { itemId, resolved: true }); await qc.invalidateQueries({ queryKey: ["vault", "rotations", vaultUid] }); toast.success("Marked as changed"); }
    catch (e) { toast.error(errMsg(e, "Couldn't save.")); }
  };
  return (
    <div className="border-b border-[#b45309]/25 bg-[#b45309]/[0.06]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12.5px]">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#b45309]" />
        <span className="min-w-0 flex-1"><strong>{todo.length} password{todo.length > 1 ? "s" : ""} to change</strong> — someone who left could open {todo.length > 1 ? "them" : "it"}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="max-h-72 overflow-y-auto border-t border-[#b45309]/20 bg-card">
          {todo.map((i) => (
            <li key={`${i.rot.id}-${i.itemId}`} className="flex items-center gap-2 border-b border-border/60 px-4 py-2 last:border-b-0">
              <button type="button" onClick={() => i.itemUid && onOpen(i.itemUid)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium">{title(i.itemUid)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {i.rot.removed ? `${i.rot.removed.firstName} ${i.rot.removed.lastName}` : "Someone"} left {ago(i.rot.removedAt)}
                  {i.seen.length ? ` · they ${i.seen.map((s) => (s === "revealed" ? "showed" : s === "filled" ? "used" : s)).join(", ")} it` : " · could open it"}
                  {i.editedSince && " · edited since"}
                </span>
              </button>
              {i.seen.some((s) => s === "revealed" || s === "copied") && <span className="rounded-full bg-[#dc2626]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#dc2626]">seen</span>}
              <button type="button" onClick={() => mark(i.rot.id, i.itemId)} className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-[11.5px] hover:bg-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Changed</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
