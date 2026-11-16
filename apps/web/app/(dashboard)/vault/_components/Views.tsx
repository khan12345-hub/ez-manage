"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Copy, Download, KeyRound, Laptop, Repeat, RotateCcw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { errMsg, lockMinutes, setLockMinutes, typeLabel, useVault, type Item } from "../_lib/session";
import { ago, copySecret, ItemIcon, StrengthBar } from "./bits";
import { ResetVault } from "./Auth";

function Page({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-5 sm:p-8">
        <h1 className="font-serif text-[30px] leading-tight">{title}</h1>
        {hint && <p className="mt-1 text-[13.5px] text-muted-foreground">{hint}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

// ───────── Security check ─────────

export function SecurityView({ onOpen }: { onOpen: (uid: string) => void }) {
  const { items } = useVault();
  const [breached, setBreached] = useState<Record<string, number> | null>(null);
  const [checking, setChecking] = useState(false);
  const logins = items.filter((i) => i.data.type === "login" && i.data.password);
  const groups = useMemo(() => {
    const byPw = new Map<string, Item[]>();
    for (const i of logins) byPw.set(i.data.password!, [...(byPw.get(i.data.password!) ?? []), i]);
    const yearAgo = Date.now() - 365 * 86400_000;
    return {
      weak: logins.filter((i) => C.strength(i.data.password!) <= 1),
      reused: logins.filter((i) => (byPw.get(i.data.password!)?.length ?? 0) > 1),
      old: logins.filter((i) => +new Date(i.data.passwordUpdatedAt ?? i.createdAt) < yearAgo),
      no2fa: logins.filter((i) => !i.data.totp),
    };
  }, [logins]);
  const pwned = breached ? logins.filter((i) => (breached[i.uid] ?? 0) > 0) : [];
  const issues = new Set([...groups.weak, ...groups.reused, ...groups.old, ...pwned].map((i) => i.uid)).size;
  const score = logins.length ? Math.round(100 * (1 - issues / logins.length)) : 100;

  const check = async () => {
    setChecking(true);
    const out: Record<string, number> = {};
    const cache = new Map<string, number>();
    try {
      for (const i of logins) {
        const pw = i.data.password!;
        if (!cache.has(pw)) cache.set(pw, await C.breachCount(pw));
        out[i.uid] = cache.get(pw)!;
      }
      setBreached(out);
    } catch { toast.error("Couldn't reach the breach check service."); } finally { setChecking(false); }
  };

  const Group = ({ title, icon: Icon, tone, list, why }: { title: string; icon: typeof ShieldAlert; tone: string; list: Item[]; why: (i: Item) => string }) => (
    <section aria-label={title} className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4" style={{ color: tone }} />
        <h2 className="flex-1 text-[14px] font-semibold">{title}</h2>
        <span className="font-mono text-[13px]" style={{ color: list.length ? tone : undefined }}>{list.length}</span>
      </header>
      {list.length ? (
        <ul>{list.slice(0, 50).map((i) => (
          <li key={i.uid}><button type="button" onClick={() => onOpen(i.uid)} className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-2 text-left last:border-b-0 hover:bg-accent/40"><ItemIcon item={i} size={28} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{i.data.title}</span><span className="block truncate text-[11.5px] text-muted-foreground">{why(i)}</span></span></button></li>
        ))}</ul>
      ) : <p className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-[#16a34a]" /> All good</p>}
    </section>
  );

  return (
    <Page title="Security check" hint="Find passwords that are weak, used more than once, old, or found in known data breaches. Everything is checked in your browser.">
      <div className="mb-5 flex flex-wrap items-center gap-5 rounded-xl border border-border bg-card p-5">
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke={score >= 80 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626"} strokeWidth="3" strokeDasharray={`${score} 100`} strokeLinecap="round" /></svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[20px]">{score}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{issues ? `${issues} login${issues > 1 ? "s" : ""} need attention` : "Your passwords look healthy"}</p>
          <p className="text-[12.5px] text-muted-foreground">{logins.length} logins checked.</p>
        </div>
        <button type="button" onClick={check} disabled={checking || !logins.length} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] hover:bg-accent disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> {checking ? "Checking…" : breached ? "Check breaches again" : "Check for breaches"}</button>
      </div>
      <p className="mb-4 text-[11.5px] text-muted-foreground">The breach check uses Have I Been Pwned: only the first 5 characters of each password&apos;s fingerprint (SHA-1) are sent, never the password.</p>
      <div className="grid gap-4">
        {breached && <Group title="Found in data breaches" icon={AlertTriangle} tone="#dc2626" list={pwned} why={(i) => `Seen ${breached[i.uid]!.toLocaleString()} times in breaches — change it now`} />}
        <Group title="Weak passwords" icon={ShieldAlert} tone="#ea580c" list={groups.weak} why={() => "Easy to guess"} />
        <Group title="Reused passwords" icon={Repeat} tone="#ca8a04" list={groups.reused} why={(i) => `Same password as ${logins.filter((x) => x.uid !== i.uid && x.data.password === i.data.password).map((x) => x.data.title).slice(0, 3).join(", ")}`} />
        <Group title="Not changed in over a year" icon={Clock} tone="#475569" list={groups.old} why={(i) => `Changed ${ago(i.data.passwordUpdatedAt ?? i.createdAt)}`} />
        <Group title="No one-time code (2FA) saved" icon={KeyRound} tone="#64748b" list={groups.no2fa} why={() => "If the site supports 2FA, turn it on and save the code here"} />
      </div>
    </Page>
  );
}

// ───────── Activity ─────────

type Ev = { id: number; action: string; createdAt: string; meta: any; user: { firstName: string; lastName: string } | null; member: { firstName: string; lastName: string } | null; itemUid: string | null; vaultUid: string | null };
const ACTION: Record<string, string> = {
  setup: "set up EZ Vault", created: "added", updated: "edited", moved: "moved", deleted: "moved to trash", restored: "restored", purged: "deleted for good",
  viewed: "opened", revealed: "showed a secret of", copied: "copied a secret of", filled: "filled in", exported: "exported",
  vault_created: "created a vault", vault_renamed: "renamed a vault", vault_deleted: "deleted a vault", member_added: "gave access to", member_removed: "removed", member_role: "changed the role of", left: "left a vault",
  master_changed: "changed their master password", reset: "reset EZ Vault", extension_connected: "connected a browser extension", extension_removed: "removed a browser extension",
};

export function ActivityView() {
  const { vaults, items, trash } = useVault();
  const [vault, setVault] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["vault", "events", vault], queryFn: async () => (await api.get<Ev[]>("/vault/events", { params: vault ? { vault } : {} })).data });
  const title = (uid: string | null) => [...items, ...trash].find((i) => i.uid === uid)?.data.title;
  return (
    <Page title="Activity" hint="Who did what. Secrets are never logged.">
      <select value={vault} onChange={(e) => setVault(e.target.value)} aria-label="Whose activity" className="mb-4 h-9 rounded-lg border border-border bg-background px-2 text-[13px]">
        <option value="">My activity</option>
        {vaults.map((v) => <option key={v.uid} value={v.uid}>Everyone in {v.name}</option>)}
      </select>
      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !data.length ? <p className="py-10 text-center text-[13px] text-muted-foreground">Nothing yet.</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <strong className="font-semibold">{e.user ? `${e.user.firstName} ${e.user.lastName}` : "Someone"}</strong> {ACTION[e.action] ?? e.action}
                {e.member && <> <strong className="font-semibold">{e.member.firstName} {e.member.lastName}</strong></>}
                {e.itemUid && <> <span className="font-medium text-foreground">{title(e.itemUid) ?? "an item"}</span></>}
                {e.meta?.field && <span className="text-muted-foreground"> ({e.meta.field})</span>}
                {e.meta?.via === "extension" && <span className="ml-1.5 rounded bg-muted px-1.5 py-px text-[10.5px] text-muted-foreground">extension</span>}
              </span>
              <span className="shrink-0 text-[11.5px] text-muted-foreground">{ago(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// ───────── Trash ─────────

export function TrashView() {
  const { trash, vaults } = useVault();
  const act = async (i: Item, forever: boolean) => {
    if (forever && !window.confirm(`Delete "${i.data.title}" for good? This can't be undone.`)) return;
    try {
      if (forever) await api.delete(`/vault/items/${i.uid}`, { params: { forever: 1 } });
      else await api.post(`/vault/items/${i.uid}/restore`);
      await useVault.getState().reload();
      toast.success(forever ? "Deleted" : "Restored");
    } catch (e) { toast.error(errMsg(e, "Couldn't do that.")); }
  };
  return (
    <Page title="Trash" hint="Items you deleted. Restore them, or delete them for good.">
      {!trash.length ? <p className="py-10 text-center text-[13px] text-muted-foreground">The trash is empty.</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {trash.map((i) => {
            const canEdit = vaults.find((v) => v.uid === i.vaultUid)?.role !== "viewer";
            return (
              <li key={i.uid} className="flex items-center gap-3 px-4 py-2.5">
                <ItemIcon item={i} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{i.data.title}</span><span className="block text-[11.5px] text-muted-foreground">{typeLabel[i.data.type]} · deleted {ago(i.deletedAt!)}</span></span>
                {canEdit && <>
                  <button type="button" onClick={() => act(i, false)} className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[12.5px] hover:bg-accent"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                  <button type="button" aria-label={`Delete ${i.data.title} for good`} onClick={() => act(i, true)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </>}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

// ───────── Settings ─────────

type Tok = { id: number; name: string; createdAt: string; lastUsedAt: string | null };
const inputCls = "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50";

export function SettingsView() {
  const qc = useQueryClient();
  const { me, items } = useVault();
  const [mins, setMins] = useState(lockMinutes());
  const { data: tokens = [] } = useQuery({ queryKey: ["vault", "tokens"], queryFn: async () => (await api.get<Tok[]>("/vault/tokens")).data });
  const [code, setCode] = useState<string | null>(null);
  const [old, setOld] = useState(""); const [nw, setNw] = useState(""); const [nw2, setNw2] = useState(""); const [acct, setAcct] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exportPw, setExportPw] = useState("");

  const connect = async () => {
    try {
      const ua = navigator.userAgent;
      const name = `${/Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Browser"} on ${/Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "this device"}`;
      const r = (await api.post<{ id: number; token: string }>("/vault/tokens", { name })).data;
      setCode(r.token);
      // the EZ Vault extension (if installed) listens for this on our own origin only
      const apiBase = String(api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");
      window.postMessage({ type: "EZVAULT_CONNECT", token: r.token, api: apiBase }, window.location.origin);
      await qc.invalidateQueries({ queryKey: ["vault", "tokens"] });
      toast.success("Connect code ready. If the extension is installed it connects by itself.");
    } catch (e) { toast.error(errMsg(e, "Couldn't connect.")); }
  };
  const revoke = async (id: number) => { await api.delete(`/vault/tokens/${id}`).catch(() => null); await qc.invalidateQueries({ queryKey: ["vault", "tokens"] }); };

  const change = async () => {
    if (!me?.keys || nw !== nw2 || nw.length < 10) return;
    setBusy(true);
    try {
      const fields = await C.changeMasterPassword(old, nw, me.keys);
      await api.post("/vault/master-password", { ...fields, accountPassword: acct });
      useVault.getState().setMe({ ...me, keys: { ...me.keys, ...fields } });
      setOld(""); setNw(""); setNw2(""); setAcct("");
      toast.success("Master password changed");
    } catch (e) { toast.error(errMsg(e, "Couldn't change it.")); } finally { setBusy(false); }
  };

  const exportAll = async () => {
    if (!me?.keys) return;
    try { await C.unlockUserKeys(exportPw, me.keys); } catch { toast.error("That master password isn't right."); return; }
    const rows = items.map((i) => ({ type: i.data.type, title: i.data.title, username: i.data.username ?? "", password: i.data.password ?? "", urls: (i.data.urls ?? []).join(" "), totp: i.data.totp ?? "", notes: i.data.notes ?? "", tags: (i.data.tags ?? []).join(","), card: i.data.card ?? null, identity: i.data.identity ?? null }));
    const blob = new Blob([JSON.stringify({ app: "EZ Vault", exportedAt: new Date().toISOString(), items: rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ez-vault-export-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
    if (items[0]) void api.post("/vault/events", { itemUid: items[0].uid, action: "exported" }).catch(() => null);
    setExportPw("");
    toast.success("Exported. The file is NOT encrypted — keep it safe and delete it when done.");
  };

  if (resetting) return <Page title="Reset EZ Vault"><ResetVault onBack={() => setResetting(false)} /></Page>;
  return (
    <Page title="Settings">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Laptop className="h-4 w-4 text-product-vault" /> Browser extension</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">The EZ Vault extension fills in logins on websites and offers to save new ones. Install it, then connect it here.</p>
        <button type="button" onClick={connect} className="mt-3 h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Connect this browser</button>
        {code && (
          <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[12px] text-muted-foreground">Connect code (shown once). If the extension didn&apos;t connect by itself, paste this into it:</p>
            <div className="mt-1.5 flex items-center gap-2"><code className="min-w-0 flex-1 truncate font-mono text-[12px]">{code}</code><button type="button" aria-label="Copy connect code" onClick={() => copySecret(code, "Connect code")} className="rounded-md p-1.5 hover:bg-accent"><Copy className="h-4 w-4" /></button></div>
          </div>
        )}
        {!!tokens.length && (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span><span className="block text-[11.5px] text-muted-foreground">Connected {ago(t.createdAt)}{t.lastUsedAt ? ` · last used ${ago(t.lastUsedAt)}` : ""}</span></span>
                <button type="button" onClick={() => revoke(t.id)} className="rounded-md border border-border px-2.5 py-1 text-[12px] hover:border-destructive/40 hover:text-destructive">Sign out</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold">Auto-lock</h2>
        <label className="mt-2 flex items-center gap-2 text-[13px]">Lock EZ Vault after
          <select value={mins} onChange={(e) => { setMins(Number(e.target.value)); setLockMinutes(Number(e.target.value)); }} className="h-8 rounded-md border border-border bg-background px-2 text-[13px]" aria-label="Auto-lock minutes">
            {[1, 5, 15, 30, 60, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
          </select> without activity</label>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold">Change master password</h2>
        <form onSubmit={(e) => { e.preventDefault(); void change(); }} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-[12px] text-muted-foreground">Current master password</span><input type="password" className={inputCls} value={old} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
          <label><span className="text-[12px] text-muted-foreground">New master password</span><input type="password" className={inputCls} value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" /></label>
          <label><span className="text-[12px] text-muted-foreground">New again</span><input type="password" className={inputCls} value={nw2} onChange={(e) => setNw2(e.target.value)} autoComplete="new-password" /></label>
          {nw && <div className="sm:col-span-2"><StrengthBar value={C.strength(nw)} /></div>}
          <label className="sm:col-span-2"><span className="text-[12px] text-muted-foreground">Your EZ Manage account password (to confirm it&apos;s you)</span><input type="password" className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)} autoComplete="off" /></label>
          <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={busy || !old || !acct || nw.length < 10 || nw !== nw2 || C.strength(nw) < 2} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Changing…" : "Change master password"}</button></div>
        </form>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Download className="h-4 w-4" /> Export</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Download all items as a readable (not encrypted) file. Enter your master password to confirm.</p>
        <form onSubmit={(e) => { e.preventDefault(); void exportAll(); }} className="mt-3 flex gap-2">
          <input type="password" className={inputCls} value={exportPw} onChange={(e) => setExportPw(e.target.value)} placeholder="Master password" aria-label="Master password to export" autoComplete="off" />
          <button type="submit" disabled={!exportPw} className="h-9 shrink-0 rounded-lg border border-border px-3 text-[13px] hover:bg-accent disabled:opacity-50">Export</button>
        </form>
      </section>

      <section className={cn("mt-5 rounded-xl border border-destructive/30 bg-card p-5")}>
        <h2 className="text-[15px] font-semibold text-destructive">Reset EZ Vault</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Only if you forgot your master password. Your personal items are deleted.</p>
        <button type="button" onClick={() => setResetting(true)} className="mt-3 h-9 rounded-lg border border-destructive/40 px-3 text-[13px] text-destructive hover:bg-destructive/5">Reset…</button>
      </section>
    </Page>
  );
}
