"use client";

/*
 * Vault admin: admin recovery (the Administrator only) and company vaults (the Administrator and each
 * company's Vault admins): who looks after them, and whether they may be shared outside the company.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, CheckCircle2, Download, KeyRound, LifeBuoy, Plus, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { errMsg, useVault } from "../_lib/session";
import { ago } from "./bits";
import { PasswordInput } from "./Auth";

type Person = { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null };
type Co = { source: "work" | "boards"; workspaceId: number; name: string; allowOutsideSharing: boolean; admins: Person[]; vaults: number };
type RecKey = { version: number; publicKey: string; encPrivateKey: string; salt: string; iterations: number; createdAt: string; covered: number; total: number } | null;
type Req = { id: number; createdAt: string; expiresAt: string; user: Person | null; requestPublicKey: string; recoveryKey: string | null };

const card = "rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(11_42_31/0.04)]";
const Badge = ({ source }: { source: Co["source"] }) => <span className={cn("rounded px-1.5 py-px text-[10px] font-semibold uppercase", source === "work" ? "bg-product-work/12 text-product-work" : "bg-product-boards/12 text-product-boards dark:text-[#a5b4fc]")}>{source === "work" ? "work" : "accounts"}</span>;

export function AdminView({ onOpenVault }: { onOpenVault: (uid: string) => void }) {
  const me = useVault((s) => s.me);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
        <div>
          <h1 className="font-serif text-[30px] leading-tight">Vault admin</h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Company vaults, who looks after them, and recovery. Admins never see what is inside a vault unless they are in it.</p>
        </div>
        {me?.isAdmin && <RecoveryCard />}
        <Companies onOpenVault={onOpenVault} />
      </div>
    </div>
  );
}

// ───────── recovery ─────────

function RecoveryCard() {
  const qc = useQueryClient();
  const { data: key, isLoading } = useQuery({ queryKey: ["vault", "admin", "recovery-key"], queryFn: async () => (await api.get<RecKey>("/vault/admin/recovery-key")).data });
  const { data: reqs = [] } = useQuery({ queryKey: ["vault", "admin", "recovery-requests"], queryFn: async () => (await api.get<Req[]>("/vault/admin/recovery-requests")).data, enabled: !!key, refetchInterval: 30_000 });
  const [setup, setSetup] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [orgKey, setOrgKey] = useState<CryptoKey | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const unlock = async () => {
    if (!key) return;
    try { setOrgKey(await C.unlockRecoveryKey(phrase.trim(), key)); setPhrase(""); } catch { toast.error("That recovery passphrase isn't right."); }
  };
  const decide = async (r: Req, approve: boolean) => {
    if (approve && (!orgKey || !r.recoveryKey)) return;
    if (!window.confirm(approve ? `Recover EZ Vault for ${r.user?.firstName} ${r.user?.lastName}? Only approve if you are sure it is really them (call them).` : "Decline this request?")) return;
    setBusy(r.id);
    try {
      if (approve) await api.post(`/vault/admin/recovery-requests/${r.id}/approve`, { wrappedKey: await C.rewrapForRequest(r.recoveryKey!, orgKey!, r.requestPublicKey) });
      else await api.post(`/vault/admin/recovery-requests/${r.id}/decline`);
      toast.success(approve ? "Approved — they can now set a new master password" : "Declined");
      await qc.invalidateQueries({ queryKey: ["vault", "admin", "recovery-requests"] });
    } catch (e) { toast.error(errMsg(e, "Couldn't do that.")); } finally { setBusy(null); }
  };

  return (
    <section aria-label="Admin recovery" className={card}>
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-product-vault/12 text-product-vault"><LifeBuoy className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">Admin recovery</span><span className="block text-[12.5px] text-muted-foreground">Help someone who forgot their master password — without anyone being able to read vaults.</span></span>
      </header>
      {isLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted" /> : !key ? (
        setup ? <RecoverySetup onDone={() => { setSetup(false); void qc.invalidateQueries({ queryKey: ["vault", "admin", "recovery-key"] }); void qc.invalidateQueries({ queryKey: ["vault", "me"] }); }} onCancel={() => setSetup(false)} /> : (
          <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-[13px]">
            <p>Recovery is <strong>off</strong>. If someone forgets their master password, they can only reset and lose their items.</p>
            <button type="button" onClick={() => setSetup(true)} className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><ShieldCheck className="h-4 w-4" /> Turn on admin recovery</button>
          </div>
        )
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Status" value="On" hint={`since ${ago(key.createdAt)}`} />
            <Stat label="Vaults covered" value={`${key.covered} / ${key.total}`} hint="others are covered at their next unlock" />
            <Stat label="Waiting for you" value={String(reqs.length)} hint="recovery requests" tone={reqs.length ? "#b45309" : undefined} />
          </div>
          {reqs.length > 0 && (
            <div>
              {!orgKey && (
                <form onSubmit={(e) => { e.preventDefault(); void unlock(); }} className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-muted/40 p-3">
                  <div className="min-w-[240px] flex-1"><PasswordInput label="Recovery passphrase (from your Emergency Kit)" value={phrase} onChange={setPhrase} /></div>
                  <button type="submit" disabled={!phrase.trim()} className="h-11 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Unlock recovery</button>
                </form>
              )}
              <ul className="divide-y divide-border rounded-xl border border-border">
                {reqs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "Someone"}</span><span className="block text-[12px] text-muted-foreground">{r.user?.email} · asked {ago(r.createdAt)} · expires {ago(r.expiresAt).replace(" ago", "")}</span></span>
                    <button type="button" disabled={busy === r.id} onClick={() => decide(r, false)} className="h-8 rounded-md border border-border px-3 text-[12.5px] hover:bg-accent">Decline</button>
                    <button type="button" disabled={!orgKey || !r.recoveryKey || busy === r.id} title={!orgKey ? "Unlock recovery first" : undefined} onClick={() => decide(r, true)} className="flex h-8 items-center gap-1 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Before approving, check it is really them (call them). They finish it themselves in the browser they asked from, by setting a new master password.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return <div className="rounded-xl bg-muted/40 p-3"><p className="text-[11.5px] text-muted-foreground">{label}</p><p className="mt-0.5 text-[20px] font-semibold" style={tone ? { color: tone } : undefined}>{value}</p>{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

function RecoverySetup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [phrase] = useState(() => C.generatePassphrase({ words: 6 }));
  const [saved, setSaved] = useState(false);
  const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState(false);
  const kit = () => {
    const text = `EZ Vault — Emergency Kit (admin recovery)\n\nRecovery passphrase:\n\n    ${phrase}\n\nCreated: ${new Date().toLocaleString()}\n\nKeep this somewhere safe and offline (printed, in a safe). Anyone with it AND\nAdministrator access can recover people's vaults. Without it, nobody can.\nEZ Manage does not keep a copy and cannot show it again.\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "EZ-Vault-Emergency-Kit.txt"; a.click(); URL.revokeObjectURL(a.href);
    setSaved(true);
  };
  const go = async () => {
    setBusy(true);
    try { await api.post("/vault/admin/recovery-key", { ...(await C.createRecoveryKeys(phrase)), accountPassword: acct }); toast.success("Admin recovery is on"); onDone(); }
    catch (e) { toast.error(errMsg(e, "Couldn't turn it on.")); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
      <p className="text-[13px]">This is your <strong>recovery passphrase</strong>. Only you keep it. You need it each time you approve a recovery.</p>
      <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-center font-mono text-[15px] tracking-wide">{phrase}</p>
      <button type="button" onClick={kit} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] hover:bg-accent"><Download className="h-4 w-4" /> Download Emergency Kit</button>
      <label className="flex items-start gap-2 text-[12.5px]"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" /> I saved the passphrase somewhere safe. If it is lost, recovery stops working (vaults stay safe).</label>
      <PasswordInput label="Your EZ Manage account password" value={acct} onChange={setAcct} autoComplete="current-password" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
        <button type="button" disabled={!saved || !acct || busy} onClick={go} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{busy ? "Turning on…" : "Turn on recovery"}</button>
      </div>
    </div>
  );
}

// ───────── companies ─────────

function Companies({ onOpenVault }: { onOpenVault: (uid: string) => void }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "admin", "companies"], queryFn: async () => (await api.get<Co[]>("/vault/admin/companies")).data });
  const refresh = () => qc.invalidateQueries({ queryKey: ["vault", "admin", "companies"] });
  return (
    <section aria-label="Companies" className={card}>
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-brass-soft"><Building2 className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold">Company vaults</span><span className="block text-[12.5px] text-muted-foreground">Shared passwords for a company (bank, portals, social media), with roles per person.</span></span>
      </header>
      {isLoading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" /> : !data.length ? <p className="mt-4 text-[13px] text-muted-foreground">You don&apos;t look after any company&apos;s vaults.</p> : (
        <ul className="mt-4 space-y-3">{data.map((c) => <CompanyRow key={`${c.source}-${c.workspaceId}`} c={c} onChanged={refresh} onOpenVault={onOpenVault} />)}</ul>
      )}
    </section>
  );
}

function CompanyRow({ c, onChanged, onOpenVault }: { c: Co; onChanged: () => void; onOpenVault: (uid: string) => void }) {
  const me = useVault((s) => s.me);
  const [adding, setAdding] = useState(false);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const { data: people = [] } = useQuery({ queryKey: ["vault", "admin", "people", c.source, c.workspaceId], queryFn: async () => (await api.get<Person[]>("/vault/admin/companies/people", { params: { source: c.source, workspaceId: c.workspaceId } })).data, enabled: adding });
  const body = { source: c.source, workspaceId: c.workspaceId };
  const toggle = async () => { try { await api.patch("/vault/admin/companies", { ...body, allowOutsideSharing: !c.allowOutsideSharing }); onChanged(); } catch (e) { toast.error(errMsg(e, "Couldn't save.")); } };
  const admin = async (userId: number, on: boolean) => {
    try { await api.post(on ? "/vault/admin/companies/admins" : "/vault/admin/companies/admins/remove", { ...body, userId }); onChanged(); toast.success(on ? "Vault admin added" : "Removed"); } catch (e) { toast.error(errMsg(e, "Couldn't save.")); }
  };
  const makeVault = async () => {
    if (!name.trim() || !me?.keys) return;
    try {
      const k = await C.newVaultKey();
      const r = (await api.post<{ uid: string }>("/vault/vaults", { encName: await C.encryptText(k, name.trim()), encVaultKey: await C.wrapVaultKey(k, me.keys.publicKey), company: body })).data;
      await useVault.getState().reload();
      toast.success("Company vault created — now add people");
      setMaking(false); setName(""); onChanged(); onOpenVault(r.uid);
    } catch (e) { toast.error(errMsg(e, "Couldn't create it.")); }
  };
  const adminIds = new Set(c.admins.map((a) => a.id));
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-[14px] font-semibold"><span className="truncate">{c.name}</span><Badge source={c.source} /></span><span className="block text-[12px] text-muted-foreground">{c.vaults} company vault{c.vaults === 1 ? "" : "s"}</span></span>
        <button type="button" onClick={() => setMaking(!making)} className="flex h-8 items-center gap-1 rounded-lg bg-forest px-2.5 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Company vault</button>
      </div>
      {making && (
        <form onSubmit={(e) => { e.preventDefault(); void makeVault(); }} className="mt-3 flex gap-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${c.name} — Bank & portals`} aria-label="Vault name" className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
          <button type="submit" disabled={!name.trim()} className="h-9 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">Create</button>
        </form>
      )}
      <label className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-[13px]">
        <span><span className="block font-medium">Allow sharing outside {c.name}</span><span className="block text-[11.5px] text-muted-foreground">If on, people can give access to someone outside the company (by their exact email). Managers and Administrators are told each time.</span></span>
        <button type="button" role="switch" aria-checked={c.allowOutsideSharing} onClick={toggle} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", c.allowOutsideSharing ? "bg-primary" : "bg-muted-foreground/30")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", c.allowOutsideSharing ? "left-[22px]" : "left-0.5")} /></button>
      </label>
      <div className="mt-3">
        <p className="mb-1.5 flex items-center text-[12px] font-medium text-muted-foreground">Vault admins <span className="ml-1 font-normal">— can create and look after this company&apos;s vaults</span>
          <button type="button" onClick={() => setAdding(!adding)} className="ml-auto flex items-center gap-1 text-primary hover:underline">{adding ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}{adding ? "Close" : "Add"}</button>
        </p>
        <ul className="flex flex-wrap gap-1.5">
          <li className="rounded-full bg-muted px-2.5 py-1 text-[12px]"><KeyRound className="mr-1 inline h-3 w-3 -translate-y-px" />Administrator</li>
          {c.admins.map((a) => <li key={a.id} className="flex items-center gap-1 rounded-full bg-product-vault/10 py-1 pl-2.5 pr-1 text-[12px]">{a.firstName} {a.lastName}<button type="button" aria-label={`Remove ${a.firstName} as Vault admin`} onClick={() => admin(a.id, false)} className="rounded-full p-0.5 hover:bg-black/10"><UserMinus className="h-3 w-3" /></button></li>)}
        </ul>
        {adding && (
          <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
            {people.filter((p) => !adminIds.has(p.id)).map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-[12.5px] last:border-b-0"><span className="min-w-0 flex-1 truncate">{p.firstName} {p.lastName} <span className="text-muted-foreground">· {p.email}</span></span><button type="button" onClick={() => admin(p.id, true)} className="rounded-md border border-border px-2 py-0.5 hover:bg-accent">Make admin</button></li>
            ))}
            {!people.length && <li className="px-3 py-2 text-[12px] text-muted-foreground">Loading…</li>}
          </ul>
        )}
      </div>
    </li>
  );
}
