"use client";

/*
 * EZ Vault → People: who can open your shared vaults, and what they may do.
 * Managers add people (EZ Manage users only), change roles, and remove someone
 * (which re-keys the vault so they can't open it again). Company vaults show the
 * Vault admins who look after them. Built on the same endpoints as the share dialog.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, Lock, Search, ShieldCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { errMsg, rekeyWithout, ROLE_HINT, ROLE_LABEL, useVault, vaultOf, type Role, type VaultRow } from "../_lib/session";
import { toast } from "sonner";
import type { Nav } from "./VaultMain";
import { fade, GLASS, GlassPage, stagger, StatTile, TILE } from "./ui";

type Person = { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null; publicKey: string | null; outside?: boolean };
type Member = { role: Role; since: string; user: Person | null; publicKey: string | null };
const ROLE_ORDER: Role[] = ["viewer", "use_only", "editor", "owner"];
const ROLE_TONE: Record<Role, string> = { owner: "#0b6b4f", editor: "#2563eb", viewer: "#64748b", use_only: "#b45309" };

function hue(s: string) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; }
function PersonAvatar({ name, size = 34 }: { name: string; size?: number }) {
  return <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: `hsl(${hue(name)} 42% 40%)`, fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}
function RolePill({ role }: { role: Role }) {
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${ROLE_TONE[role]}18`, color: ROLE_TONE[role] }} title={ROLE_HINT[role]}>{ROLE_LABEL[role]}</span>;
}

export function PeopleView({ onNav }: { onNav: (n: Nav) => void }) {
  const { vaults, me } = useVault();
  const shared = vaults.filter((v) => v.kind === "shared");
  const managed = shared.filter((v) => v.role === "owner").length;

  // distinct people across shared vaults (members include you) — one query per vault
  const memberQueries = useQuery({
    queryKey: ["vault", "people-view", shared.map((v) => v.uid).join(",")],
    enabled: shared.length > 0,
    queryFn: async () => {
      const all = await Promise.all(shared.map(async (v) => ({ uid: v.uid, members: (await api.get<Member[]>(`/vault/vaults/${v.uid}/members`)).data })));
      return all;
    },
  });
  const peopleCount = useMemo(() => {
    const ids = new Set<number>();
    for (const row of memberQueries.data ?? []) for (const m of row.members) if (m.user) ids.add(m.user.id);
    return ids.size;
  }, [memberQueries.data]);

  return (
    <GlassPage title="People" hint="Who can open your shared vaults, and what each person may do. Removing someone gives the vault a new key, so they can't open anything in it again.">
      <motion.div variants={stagger} className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3" role="list" aria-label="People numbers">
        <StatTile icon={Users} label="People" value={peopleCount} sub="across your shared vaults" tone="#0b6b4f" />
        <StatTile icon={Building2} label="Shared vaults" value={shared.length} sub={managed ? `${managed} you manage` : "none you manage"} tone="#2563eb" />
        <StatTile icon={ShieldCheck} label="You manage" value={managed} sub="as a Manager" tone="#b45309" onClick={me?.isVaultAdmin ? () => onNav({ kind: "admin" }) : undefined} />
      </motion.div>

      {me?.isVaultAdmin && (
        <motion.button variants={fade} type="button" onClick={() => onNav({ kind: "admin" })} className={cn(TILE, "mb-4 flex w-full items-center gap-3 p-4 text-left transition hover:shadow-[0_18px_40px_-22px_rgba(11,42,31,0.5)]")}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-brass-soft"><ShieldCheck className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Vault admin area</span><span className="block text-[12px] text-muted-foreground">Company vaults, their Vault admins, and recovery.</span></span>
          <span className="text-[12.5px] font-semibold text-primary">Open →</span>
        </motion.button>
      )}

      {!shared.length ? (
        <motion.div variants={fade} className={cn(GLASS, "flex flex-col items-center gap-2 px-6 py-16 text-center")}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-product-vault/12 text-product-vault"><Users className="h-6 w-6" /></span>
          <p className="text-[14px] font-semibold">No shared vaults yet</p>
          <p className="max-w-sm text-[13px] text-muted-foreground">Create a shared vault to give a team the same logins — each person gets their own role. Start one from the sidebar.</p>
        </motion.div>
      ) : (
        <motion.div variants={stagger} className="space-y-4">
          {shared.map((v) => <VaultPeopleCard key={v.uid} vault={v} onLeft={() => onNav({ kind: "overview" })} />)}
        </motion.div>
      )}
    </GlassPage>
  );
}

function VaultPeopleCard({ vault, onLeft }: { vault: VaultRow; onLeft: () => void }) {
  const qc = useQueryClient();
  const me = useVault((s) => s.me);
  const v = vaultOf(vault.uid) ?? vault;
  const isOwner = v.role === "owner";
  const key = ["vault", "members", vault.uid];
  const { data: members = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Member[]>(`/vault/vaults/${vault.uid}/members`)).data });
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const { data: people = [] } = useQuery({ queryKey: ["vault", "people", q, vault.uid], queryFn: async () => (await api.get<Person[]>("/vault/people", { params: { q, vault: vault.uid } })).data, enabled: isOwner && adding });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: key }); await qc.invalidateQueries({ queryKey: ["vault", "people-view"] }); await useVault.getState().reload(); };

  const add = async (p: Person) => {
    const cur = vaultOf(vault.uid); if (!cur || !p.publicKey) return;
    if (p.outside && !window.confirm(`${p.firstName} ${p.lastName} is not in ${cur.company ? cur.company.name : "your companies"}. Give them access anyway? The vault's managers and the Administrator will be told.`)) return;
    setBusy(true);
    try {
      await api.post(`/vault/vaults/${vault.uid}/members`, { userId: p.id, role, encVaultKey: await C.wrapVaultKey(cur.key, p.publicKey), keyVersion: cur.keyVersion });
      toast.success(`${p.firstName} can now open ${cur.name}`);
      await refresh();
    } catch (e) { toast.error(errMsg(e, "Couldn't share.")); } finally { setBusy(false); }
  };
  const setRoleOf = async (m: Member, r: string) => {
    try { await api.patch(`/vault/vaults/${vault.uid}/members/${m.user!.id}`, { role: r }); await refresh(); toast.success("Role changed"); } catch (e) { toast.error(errMsg(e, "Couldn't change the role.")); }
  };
  const remove = async (m: Member) => {
    const self = m.user?.id === me?.user.id;
    if (!window.confirm(self ? `Leave "${v.name}"? You won't see its items any more.` : `Remove ${m.user?.firstName} from "${v.name}"? The vault gets a new key, so they can't open anything in it again. (Passwords they already saw should be changed.)`)) return;
    setBusy(true);
    try {
      await rekeyWithout(vault.uid, m.user!.id);
      toast.success(self ? "You left the vault" : "Removed");
      if (self) { await useVault.getState().reload(); onLeft(); } else await refresh();
    } catch (e) { toast.error(errMsg(e, "Couldn't remove.")); } finally { setBusy(false); }
  };

  const managers = members.filter((m) => m.role === "owner");
  const memberIds = new Set(members.map((m) => m.user?.id));
  const candidates = people.filter((p) => !memberIds.has(p.id));

  return (
    <motion.section variants={fade} aria-label={v.name} className={cn(GLASS, "overflow-hidden")}>
      <header className="flex flex-wrap items-center gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-brass-soft">{v.company ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[16px] font-semibold"><span className="truncate">{v.name}</span>{v.company && <span className="rounded-full bg-[#b08d57]/14 px-2 py-0.5 text-[10.5px] font-semibold text-[#8a6a35] dark:text-[#d9bd8c]">{v.company.name}</span>}</span>
          <span className="block text-[12px] text-muted-foreground">{members.length} {members.length === 1 ? "person" : "people"} · you are {ROLE_LABEL[v.role]}</span>
        </span>
        {isOwner && <button type="button" onClick={() => setAdding((x) => !x)} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">{adding ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{adding ? "Close" : "Add people"}</button>}
      </header>

      {v.company && (
        <p className="flex items-center gap-2 border-b border-black/[0.06] bg-[#b08d57]/[0.05] px-5 py-2 text-[12px] text-muted-foreground dark:border-white/10">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#b08d57]" />
          Looked after by {managers.length ? <>its Manager{managers.length > 1 ? "s" : ""} (<strong className="text-foreground/80">{managers.map((m) => m.user ? `${m.user.firstName} ${m.user.lastName}` : "—").join(", ")}</strong>) and this company&rsquo;s Vault admins.</> : "this company’s Vault admins."}
        </p>
      )}

      {isOwner && adding && (
        <div className="border-b border-black/[0.06] bg-white/40 px-5 py-4 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="mb-2 text-[11.5px] text-muted-foreground"><strong style={{ color: ROLE_TONE[role] }}>{ROLE_LABEL[role]}:</strong> {ROLE_HINT[role]}.{role === "use_only" && " Passwords are never shown, copied or exported for them (a strong guard in the apps, not encryption)."}</p>
          <div className="flex gap-2">
            <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search people in ${v.company ? v.company.name : "your companies"} — or a full email`} aria-label="Search people" className="w-full bg-transparent text-[13px] outline-none" /></label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role for new people" className="h-10 rounded-xl border border-border bg-background px-2 text-[12.5px]">{ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          </div>
          <ul className="mt-2 max-h-56 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border bg-background">
            {!candidates.length && <li className="p-3 text-[12.5px] text-muted-foreground">No one to add{q ? " — try a full email address" : ""}.</li>}
            {candidates.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                <PersonAvatar name={`${p.firstName}`} size={30} />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 truncate text-[13px] font-medium">{p.firstName} {p.lastName}{p.outside && <span className="rounded-full bg-[#b45309]/12 px-1.5 py-px text-[10px] font-semibold text-[#b45309]">outside</span>}</span><span className="block truncate text-[11.5px] text-muted-foreground">{p.email}</span></span>
                {p.publicKey ? <button type="button" disabled={busy} onClick={() => add(p)} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12.5px] hover:bg-accent disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" /> Add</button> : <span className="text-[11px] text-muted-foreground">No EZ Vault yet</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border/50">
        {isLoading && <li className="px-5 py-4 text-[12.5px] text-muted-foreground">Loading…</li>}
        {members.map((m) => {
          const self = m.user?.id === me?.user.id;
          return (
            <li key={m.user?.id} className="flex items-center gap-3 px-5 py-2.5">
              <PersonAvatar name={`${m.user?.firstName ?? "?"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{m.user ? `${m.user.firstName} ${m.user.lastName}` : "Someone"}{self && " (you)"}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">{m.user?.email}</span>
              </span>
              {isOwner && !self ? (
                <select value={m.role} onChange={(e) => setRoleOf(m, e.target.value)} aria-label={`Role of ${m.user?.firstName}`} title={ROLE_HINT[m.role]} className="h-8 rounded-lg border border-border bg-background px-1.5 text-[12.5px]">
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : <RolePill role={m.role} />}
              {(isOwner || self) && members.length > 1 && (
                <button type="button" disabled={busy} aria-label={self ? "Leave vault" : `Remove ${m.user?.firstName}`} title={self ? "Leave" : "Remove"} onClick={() => remove(m)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">{self ? <Lock className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}</button>
              )}
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
