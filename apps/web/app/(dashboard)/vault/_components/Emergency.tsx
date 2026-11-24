"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LifeBuoy, Search, UserPlus, Clock, ShieldCheck, Check, X, Hourglass } from "lucide-react";
import { api } from "@/lib/api";
import * as C from "@/lib/vault/vault-crypto";
import { cn } from "@/lib/utils";
import { errMsg, useVault, ROLE_LABEL, type Role } from "../_lib/session";
import { GlassPage, GLASS, fade } from "./ui";

type Lite = { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null };
type Person = Lite & { publicKey: string | null; outside?: boolean };
type Status = "offered" | "requested" | "active" | "revoked" | "declined";
type Grant = {
  id: number; role: Role; mode: "wait" | "approval"; waitDays: number; status: Status;
  requestedAt: string | null; activatesAt: string | null; activatedAt: string | null; createdAt: string;
  grantee?: Lite | null; granter?: Lite | null;
};

const name = (p?: Lite | null) => (p ? `${p.firstName} ${p.lastName}` : "Someone");
const GRANT_ROLES: Role[] = ["viewer", "editor", "owner"];

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const d = Math.ceil(ms / 86_400_000);
  return d <= 1 ? "within a day" : `in ${d} days`;
}

export function EmergencyView() {
  const qc = useQueryClient();
  const { vaults } = useVault();
  const personal = vaults.find((v) => v.kind === "personal");
  const { data, isLoading } = useQuery({ queryKey: ["vault", "emergency"], queryFn: async () => (await api.get<{ given: Grant[]; received: Grant[] }>("/vault/emergency")).data });
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["vault", "emergency"] }); await useVault.getState().reload(); };

  const act = async (id: number, action: "request" | "approve" | "decline" | "revoke" | "leave", ok: string) => {
    try { await api.post(`/vault/emergency/${id}/${action}`); toast.success(ok); await refresh(); }
    catch (e) { toast.error(errMsg(e, "Couldn't do that.")); }
  };

  return (
    <GlassPage title="Emergency access" hint="Let someone you trust open your vault if something happens to you — or get access to someone who trusted you. Zero-knowledge: access is a key wrapped for them in your browser, and you can set a waiting period or approve each time.">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* People you trust */}
        <motion.section variants={fade} className={cn(GLASS, "overflow-hidden")}>
          <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><LifeBuoy className="h-4 w-4 text-product-vault" /><h2 className="flex-1 text-[13.5px] font-semibold">People you trust</h2></header>
          <div className="p-3">
            {personal ? <AddTrusted personal={personal} existing={data?.given ?? []} onAdded={refresh} /> : <p className="text-[12.5px] text-muted-foreground">Set up your vault first.</p>}
            <ul className="mt-3 space-y-2">
              {(data?.given ?? []).filter((g) => g.status !== "revoked").map((g) => (
                <li key={g.id} className="rounded-xl border border-border bg-background/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{name(g.grantee)}</span><span className="block truncate text-[11.5px] text-muted-foreground">{g.grantee?.email}</span></span>
                    <StatusChip g={g} side="given" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] text-muted-foreground">{ROLE_LABEL[g.role]} · {g.mode === "wait" ? `${g.waitDays}-day wait` : "you approve"}</span>
                    <span className="flex-1" />
                    {g.status === "requested" && (
                      <>
                        <button type="button" onClick={() => act(g.id, "approve", "Access granted")} className="flex h-7 items-center gap-1 rounded-lg bg-forest px-2.5 text-[12px] font-semibold text-white dark:bg-primary"><Check className="h-3.5 w-3.5" /> {g.mode === "wait" ? "Open now" : "Approve"}</button>
                        <button type="button" onClick={() => act(g.id, "decline", "Request declined")} className="h-7 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:bg-accent">Decline</button>
                      </>
                    )}
                    <button type="button" onClick={() => { if (window.confirm(`Remove ${name(g.grantee)}'s access? ${g.status === "active" ? "Your vault gets a new key so their access ends." : ""}`)) act(g.id, "revoke", "Access removed"); }} className="h-7 rounded-lg border border-border px-2.5 text-[12px] font-medium text-destructive hover:bg-destructive/10">Remove</button>
                  </div>
                </li>
              ))}
              {!isLoading && !(data?.given ?? []).filter((g) => g.status !== "revoked").length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">No one yet. Add a person you trust above.</li>}
            </ul>
          </div>
        </motion.section>

        {/* People who trust you */}
        <motion.section variants={fade} className={cn(GLASS, "overflow-hidden")}>
          <header className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10"><ShieldCheck className="h-4 w-4 text-product-vault" /><h2 className="flex-1 text-[13.5px] font-semibold">People who trust you</h2></header>
          <ul className="space-y-2 p-3">
            {(data?.received ?? []).filter((g) => g.status !== "declined" && g.status !== "revoked").map((g) => (
              <li key={g.id} className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{name(g.granter)}</span><span className="block truncate text-[11.5px] text-muted-foreground">{g.granter?.email}</span></span>
                  <StatusChip g={g} side="received" />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11.5px] text-muted-foreground">{ROLE_LABEL[g.role]} access{g.mode === "wait" ? ` · ${g.waitDays}-day wait` : " · they approve"}</span>
                  <span className="flex-1" />
                  {(g.status === "offered") && <button type="button" onClick={() => act(g.id, "request", g.mode === "wait" ? "Requested — the wait has started" : "Requested — waiting for approval")} className="h-7 rounded-lg bg-forest px-2.5 text-[12px] font-semibold text-white dark:bg-primary">Request access</button>}
                  {g.status === "requested" && g.mode === "wait" && <span className="flex items-center gap-1 text-[12px] text-amber-600 dark:text-amber-400"><Hourglass className="h-3.5 w-3.5" /> Opens {daysLeft(g.activatesAt)}</span>}
                  {g.status === "requested" && g.mode === "approval" && <span className="flex items-center gap-1 text-[12px] text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Waiting for approval</span>}
                  {g.status === "active" && <span className="flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Open — in your vault list</span>}
                  {g.status !== "offered" && <button type="button" onClick={() => { if (window.confirm("Give up this access?")) act(g.id, "leave", "You gave up the access"); }} className="h-7 rounded-lg border border-border px-2.5 text-[12px] font-medium hover:bg-accent">Give up</button>}
                </div>
              </li>
            ))}
            {!isLoading && !(data?.received ?? []).filter((g) => g.status !== "declined" && g.status !== "revoked").length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">No one has trusted you with their vault.</li>}
          </ul>
        </motion.section>
      </div>
    </GlassPage>
  );
}

function StatusChip({ g, side }: { g: Grant; side: "given" | "received" }) {
  const map: Record<Status, { t: string; c: string }> = {
    offered: { t: side === "given" ? "Offered" : "Offered to you", c: "bg-muted text-muted-foreground" },
    requested: { t: "Requested", c: "bg-amber-500/12 text-amber-700 dark:text-amber-400" },
    active: { t: "Active", c: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" },
    declined: { t: "Declined", c: "bg-muted text-muted-foreground" },
    revoked: { t: "Removed", c: "bg-muted text-muted-foreground" },
  };
  const s = map[g.status];
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.c)}>{s.t}</span>;
}

function AddTrusted({ personal, existing, onAdded }: { personal: { uid: string; key: CryptoKey; keyVersion: number }; existing: Grant[]; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [mode, setMode] = useState<"approval" | "wait">("approval");
  const [waitDays, setWaitDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const { data: people = [] } = useQuery({ queryKey: ["vault", "people", q], queryFn: async () => (await api.get<Person[]>("/vault/people", { params: { q } })).data });
  const taken = new Set(existing.filter((g) => g.status !== "revoked" && g.status !== "declined").map((g) => g.grantee?.id));
  const candidates = people.filter((p) => !taken.has(p.id));

  const add = async (p: Person) => {
    if (!p.publicKey) return;
    setBusy(true);
    try {
      await api.post("/vault/emergency", {
        vaultUid: personal.uid, granteeId: p.id, role, mode, waitDays,
        encVaultKey: await C.wrapVaultKey(personal.key, p.publicKey), keyVersion: personal.keyVersion,
      });
      toast.success(`${p.firstName} can now be given emergency access`);
      setQ("");
      onAdded();
    } catch (e) { toast.error(errMsg(e, "Couldn't set that up.")); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, or type a full email" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Access level" className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px]">{GRANT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        <select value={mode} onChange={(e) => setMode(e.target.value as "approval" | "wait")} aria-label="When it turns on" className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px]">
          <option value="approval">I approve</option>
          <option value="wait">Wait period</option>
        </select>
        {mode === "wait" && (
          <span className="flex items-center gap-1 text-[12.5px]"><input type="number" min={0} max={90} value={waitDays} onChange={(e) => setWaitDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} className="h-9 w-14 rounded-lg border border-border bg-background px-2 text-[12.5px]" /> days</span>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{mode === "wait" ? `They request, and access opens after ${waitDays} day${waitDays === 1 ? "" : "s"} unless you decline — works even if you're away.` : "They request, and access opens only when you approve."}</p>
      {q && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
          {!candidates.length && <li className="p-2.5 text-[12px] text-muted-foreground">No one to add.</li>}
          {candidates.map((p) => (
            <li key={p.id} className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 last:border-b-0">
              <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{p.firstName} {p.lastName}</span><span className="block truncate text-[11px] text-muted-foreground">{p.email}</span></span>
              {p.publicKey ? <button type="button" disabled={busy} onClick={() => add(p)} className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[12px] hover:bg-accent disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" /> Trust</button> : <span className="text-[11px] text-muted-foreground">No EZ Vault</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
