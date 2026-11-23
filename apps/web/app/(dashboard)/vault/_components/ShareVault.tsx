"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import * as C from "@/lib/vault/vault-crypto";
import { errMsg, rekeyWithout, ROLE_HINT, ROLE_LABEL, useVault, vaultOf, type Role } from "../_lib/session";

type Person = { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null; publicKey: string | null; outside?: boolean };
type Member = { role: Role; since: string; user: Person | null; publicKey: string | null };
const ROLE_ORDER: Role[] = ["viewer", "use_only", "editor", "owner"];

export function NewVaultDialog({ onClose, onMade }: { onClose: () => void; onMade: (uid: string) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const me = useVault((s) => s.me);
  const make = async () => {
    if (!name.trim() || !me?.keys) return;
    setBusy(true);
    try {
      const k = await C.newVaultKey();
      const r = (await api.post<{ uid: string }>("/vault/vaults", { encName: await C.encryptText(k, name.trim()), encVaultKey: await C.wrapVaultKey(k, me.keys.publicKey) })).data;
      await useVault.getState().reload();
      toast.success("Vault created");
      onMade(r.uid);
    } catch (e) { toast.error(errMsg(e, "Couldn't create the vault.")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>New shared vault</DialogTitle>
        <DialogDescription>A vault for a team, e.g. &quot;Marketing logins&quot;. You choose who can open it.</DialogDescription>
        <form onSubmit={(e) => { e.preventDefault(); void make(); }} className="space-y-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vault name" aria-label="Vault name" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
            <button type="submit" disabled={busy || !name.trim()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Create</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShareVault({ vaultUid, onClose, onLeft }: { vaultUid: string; onClose: () => void; onLeft: () => void }) {
  const qc = useQueryClient();
  const me = useVault((s) => s.me);
  const v = vaultOf(vaultUid);
  const isOwner = v?.role === "owner";
  const key = ["vault", "members", vaultUid];
  const { data: members = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Member[]>(`/vault/vaults/${vaultUid}/members`)).data });
  const [q, setQ] = useState("");
  const { data: people = [] } = useQuery({ queryKey: ["vault", "people", q, vaultUid], queryFn: async () => (await api.get<Person[]>("/vault/people", { params: { q, vault: vaultUid } })).data, enabled: isOwner });
  const [role, setRole] = useState<Member["role"]>("viewer");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: key }); await useVault.getState().reload(); };
  if (!v) return null;

  const add = async (p: Person) => {
    if (!p.publicKey) return;
    if (p.outside && !window.confirm(`${p.firstName} ${p.lastName} is not in ${v.company ? v.company.name : "your companies"}. Give them access anyway? The vault's managers and the Administrator will be told.`)) return;
    setBusy(true);
    try {
      await api.post(`/vault/vaults/${vaultUid}/members`, { userId: p.id, role, encVaultKey: await C.wrapVaultKey(v.key, p.publicKey), keyVersion: v.keyVersion });
      toast.success(`${p.firstName} can now open ${v.name}`);
      await refresh();
    } catch (e) { toast.error(errMsg(e, "Couldn't share.")); } finally { setBusy(false); }
  };
  const remove = async (m: Member) => {
    const self = m.user?.id === me?.user.id;
    if (!window.confirm(self ? `Leave "${v.name}"? You won't see its items any more.` : `Remove ${m.user?.firstName} from "${v.name}"? The vault gets a new key, so they can't open anything in it again. (Passwords they already saw should be changed.)`)) return;
    setBusy(true);
    try {
      await rekeyWithout(vaultUid, m.user!.id);
      toast.success(self ? "You left the vault" : "Removed");
      if (self) { await useVault.getState().reload(); onLeft(); } else await refresh();
    } catch (e) { toast.error(errMsg(e, "Couldn't remove.")); } finally { setBusy(false); }
  };
  const setRoleOf = async (m: Member, r: string) => {
    try { await api.patch(`/vault/vaults/${vaultUid}/members/${m.user!.id}`, { role: r }); await refresh(); } catch (e) { toast.error(errMsg(e, "Couldn't change the role.")); }
  };
  const rename = async () => {
    if (!renaming?.trim()) return;
    try { await api.patch(`/vault/vaults/${vaultUid}`, { encName: await C.encryptText(v.key, renaming.trim()) }); setRenaming(null); await useVault.getState().reload(); } catch (e) { toast.error(errMsg(e, "Couldn't rename.")); }
  };
  const del = async () => {
    if (!window.confirm(`Delete the vault "${v.name}" and everything in it, for everyone?`)) return;
    try { await api.delete(`/vault/vaults/${vaultUid}`); await useVault.getState().reload(); toast.success("Vault deleted"); onLeft(); } catch (e) { toast.error(errMsg(e, "Couldn't delete.")); }
  };
  const memberIds = new Set(members.map((m) => m.user?.id));
  const candidates = people.filter((p) => !memberIds.has(p.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle>{renaming !== null ? "Rename vault" : v.name}</DialogTitle>
        <DialogDescription>{v.company ? `Company vault of ${v.company.name}. ` : ""}Everyone here can use every item in this vault; what they may do depends on their role. Items are encrypted for each person separately.</DialogDescription>
        {renaming !== null ? (
          <form onSubmit={(e) => { e.preventDefault(); void rename(); }} className="flex gap-2">
            <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Vault name" className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[13.5px] outline-none" />
            <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground">Save</button>
          </form>
        ) : isOwner && <div className="flex gap-3 text-[12.5px]"><button type="button" onClick={() => setRenaming(v.name)} className="text-primary hover:underline">Rename</button><button type="button" onClick={del} className="text-destructive hover:underline">Delete vault</button></div>}

        <section aria-label="People in this vault">
          <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">People ({members.length})</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {isLoading && <li className="p-3 text-[12.5px] text-muted-foreground">Loading…</li>}
            {members.map((m) => (
              <li key={m.user?.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{m.user ? `${m.user.firstName} ${m.user.lastName}` : "Someone"}{m.user?.id === me?.user.id && " (you)"}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{m.user?.email}</span>
                </span>
                {isOwner && m.user?.id !== me?.user.id ? (
                  <select value={m.role} onChange={(e) => setRoleOf(m, e.target.value)} aria-label={`Role of ${m.user?.firstName}`} title={ROLE_HINT[m.role]} className="h-8 rounded-md border border-border bg-background px-1.5 text-[12.5px]">
                    {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ) : <span className="text-[12px] text-muted-foreground" title={ROLE_HINT[m.role]}>{ROLE_LABEL[m.role]}</span>}
                {(isOwner || m.user?.id === me?.user.id) && members.length > 1 && (
                  <button type="button" disabled={busy} aria-label={m.user?.id === me?.user.id ? "Leave vault" : `Remove ${m.user?.firstName}`} title={m.user?.id === me?.user.id ? "Leave" : "Remove"} onClick={() => remove(m)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isOwner && (
          <section aria-label="Add people">
            <p className="mb-1.5 mt-2 text-[12px] font-medium text-muted-foreground">Add people from {v.company ? v.company.name : "your companies"} <span className="font-normal">— or type someone&apos;s full email to add a person outside it</span></p>
            <p className="mb-2 text-[11.5px] text-muted-foreground"><strong>{ROLE_LABEL[role]}:</strong> {ROLE_HINT[role]}.{role === "use_only" && " A strong guard in EZ Manage’s apps (passwords are never shown, copied or exported), not encryption."}</p>
            <div className="flex gap-2">
              <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" /></label>
              <select value={role} onChange={(e) => setRole(e.target.value as Member["role"])} aria-label="Role for new people" className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px]">{ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            </div>
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
              {!candidates.length && <li className="p-3 text-[12.5px] text-muted-foreground">No one to add.</li>}
              {candidates.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0">
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 truncate text-[13px] font-medium">{p.firstName} {p.lastName}{p.outside && <span className="rounded-full bg-[#b45309]/12 px-1.5 py-px text-[10px] font-semibold text-[#b45309]">outside</span>}</span><span className="block truncate text-[11.5px] text-muted-foreground">{p.email}</span></span>
                  {p.publicKey ? <button type="button" disabled={busy} onClick={() => add(p)} className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[12.5px] hover:bg-accent disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" /> Add</button> : <span className="text-[11.5px] text-muted-foreground">Hasn&apos;t set up EZ Vault</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
