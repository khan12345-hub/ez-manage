"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CheckCircle2, Crown, Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { accessApi, roleLabel, type AccessCompanies, type ManagerScope, type MyAccess, type ProductKey } from "@/services/access.api";
import { Confirm, PRODUCT_META, Person, RoleChip, errText } from "./bits";
import { HistoryList } from "./History";

const ACC_ROLES = ["ADMIN", "MEMBER", "VIEWER", "GUEST"];
const WORK_ROLES = ["ADMIN", "MEMBER", "LIMITED_MEMBER", "GUEST"];
const sel = "h-8 rounded-lg border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/50";

export function UserDrawer({ id, me, companies, onClose }: { id: number | null; me: MyAccess; companies?: AccessCompanies; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: u, isLoading } = useQuery({ queryKey: ["access", "user", id], queryFn: () => accessApi.user(id!), enabled: !!id });
  const [tab, setTab] = useState<"access" | "history">("access");
  const [confirm, setConfirm] = useState<null | { title: string; body: React.ReactNode; action: string; danger?: boolean; type?: string; run: () => Promise<unknown> }>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["access"] }); };
  const act = useMutation({
    mutationFn: (f: () => Promise<unknown>) => f(),
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(errText(e)),
  });
  const run = (f: () => Promise<unknown>, ok?: string) => act.mutate(async () => { await f(); if (ok) toast.success(ok); });
  const name = u ? `${u.firstName} ${u.lastName}`.trim() || u.email : "";
  const isAdminUser = u?.systemRole === "SUPER_ADMIN";
  const disabled = u && u.status !== "ACTIVE";

  const ProductHead = ({ p, sub }: { p: ProductKey; sub?: React.ReactNode }) => {
    const s = (u?.products as any)?.[p];
    const canToggle = me.admin && p !== "executive";
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: PRODUCT_META[p].color }}>{PRODUCT_META[p].short.slice(0, 2)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{PRODUCT_META[p].label}</span>
          <span className="block text-[11.5px] text-muted-foreground">{sub}</span>
        </span>
        {canToggle && s && (
          <Switch checked={!!s.on} aria-label={`${PRODUCT_META[p].label} for ${name}`}
            onCheckedChange={(on) => on
              ? run(() => accessApi.setProduct(p, [u!.id], true), `${PRODUCT_META[p].label} turned on`)
              : setConfirm({ title: `Turn ${PRODUCT_META[p].label} off for ${name}?`, body: <>They lose access to {PRODUCT_META[p].label} right away. Their companies and roles are kept, so turning it back on restores them.</>, action: "Turn off", danger: true, run: () => accessApi.setProduct(p, [u!.id], false) })} />
        )}
        {p === "executive" && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s?.on ? "bg-[#b45309]/12 text-[#b45309]" : "bg-muted text-muted-foreground")}>{s?.on ? "Administrator" : "Administrators only"}</span>}
      </div>
    );
  };

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[560px]">
        <SheetTitle className="sr-only">{name || "Person"}</SheetTitle>
        <SheetDescription className="sr-only">Products, companies and roles for this person</SheetDescription>
        {isLoading || !u ? <div className="m-5 h-64 animate-pulse rounded-2xl bg-muted" /> : (
          <div className="pb-8">
            <div className="relative bg-gradient-to-br from-forest to-[#0d3b2b] px-5 pb-5 pt-6 text-white">
              <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
              <Person p={u} size={52} onDark sub={<span className="text-white/70">{u.email}</span>} />
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px] font-semibold">
                {isAdminUser && <span className="flex items-center gap-1 rounded-full bg-[#b08d57] px-2 py-0.5 text-forest"><Crown className="h-3 w-3" /> Administrator</span>}
                {!!u.managerScopes?.length && <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5"><ShieldCheck className="h-3 w-3" /> Access Manager · {u.managerScopes.length}</span>}
                {disabled && <span className="rounded-full bg-[#dc2626] px-2 py-0.5">Disabled</span>}
                {u.lastLoginAt && <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium">Last sign-in {new Date(u.lastLoginAt).toLocaleDateString()}</span>}
              </div>
            </div>
            <div role="tablist" className="flex gap-1 border-b border-border px-5 pt-3">
              {(["access", "history"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={cn("-mb-px border-b-2 px-3 pb-2 text-[13px] font-semibold", tab === t ? "border-forest text-foreground dark:border-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t === "access" ? "Access" : "History"}</button>)}
            </div>

            {tab === "history" ? <div className="px-3 pt-3"><HistoryList rows={u.history} compact /></div> : (
              <div className="space-y-3 px-4 pt-4">
                {/* Accounts & Invoices */}
                <Card>
                  <ProductHead p="accounts" sub={u.products.accounts.companies.length ? `${u.products.accounts.companies.length} ${u.products.accounts.companies.length === 1 ? "company" : "companies"}` : "Not in any company"} />
                  <Companies rows={u.products.accounts.companies.map((c) => ({ id: c.workspace.id, name: c.workspace.name, role: c.role, extra: `${c.boards} ${c.boards === 1 ? "board" : "boards"}` }))}
                    product="accounts" roles={ACC_ROLES} grantAdmin={(ws) => me.admin || !!companies?.accounts.find((c) => c.id === ws)?.mayGrantAdmin} busy={act.isPending}
                    onRole={(ws, r) => run(() => accessApi.roleAccounts(u.id, ws, r), "Role changed")}
                    onRemove={(ws, n) => setConfirm({ title: `Remove ${name} from ${n}?`, body: "They lose this company's boards in Accounts & Invoices. Their past work stays.", action: "Remove", danger: true, run: () => accessApi.removeAccounts(u.id, ws) })} />
                  <AddCompany product="accounts" options={(companies?.accounts ?? []).filter((c) => !u.products.accounts.companies.some((x) => x.workspace.id === c.id))} roles={ACC_ROLES} busy={act.isPending}
                    onAdd={(ws, role, boards) => run(() => accessApi.addAccounts(u.id, { workspaceId: ws, role, boardIds: boards }), "Added")} />
                </Card>
                {/* Company Work */}
                <Card>
                  <ProductHead p="work" sub={u.products.work.companies.length ? `${u.products.work.companies.length} ${u.products.work.companies.length === 1 ? "company" : "companies"}` : "Not in any company"} />
                  <Companies rows={u.products.work.companies.map((c) => ({ id: c.workspace.id, name: c.workspace.name, role: c.role }))}
                    product="work" roles={WORK_ROLES} grantAdmin={(ws) => me.admin || !!companies?.work.find((c) => c.id === ws)?.mayGrantAdmin} busy={act.isPending}
                    onRole={(ws, r) => run(() => accessApi.roleWork(u.id, ws, r), "Role changed")}
                    onRemove={(ws, n) => setConfirm({ title: `Remove ${name} from ${n}?`, body: "They lose this company in Company Work. Their tasks stay.", action: "Remove", danger: true, run: () => accessApi.removeWork(u.id, ws) })} />
                  <AddCompany product="work" options={(companies?.work ?? []).filter((c) => !u.products.work.companies.some((x) => x.workspace.id === c.id))} roles={WORK_ROLES} busy={act.isPending}
                    onAdd={(ws, role) => run(() => accessApi.addWork(u.id, { workspaceId: ws, role }), "Added")} />
                </Card>
                {/* EZ Tracker */}
                <Card>
                  <ProductHead p="tracker" sub={`${u.products.tracker.trackedCompanies} ${u.products.tracker.trackedCompanies === 1 ? "company" : "companies"} · ${u.products.tracker.devices} ${u.products.tracker.devices === 1 ? "computer" : "computers"}${u.products.tracker.adminOf ? ` · Tracker admin in ${u.products.tracker.adminOf}` : ""}`} />
                  <p className="mt-2 text-[12px] text-muted-foreground">Tracker people and Tracker admins are managed inside EZ Tracker (People and Settings).</p>
                </Card>
                {me.admin && u.products.vault && (
                  <Card><ProductHead p="vault" sub={u.products.vault.setUp ? "Vault set up" : "Vault not set up yet"} /></Card>
                )}
                {me.admin && u.products.executive && <Card><ProductHead p="executive" sub="Executive Hub is for Administrators and Co-Administrators" /></Card>}

                {/* Administrator only: system role, Access Manager, account */}
                {me.admin && (
                  <>
                    <Card>
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b08d57] text-forest"><Crown className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Co-Administrator</span><span className="block text-[11.5px] text-muted-foreground">Full control of every product, the Access Center and Executive Hub</span></span>
                        <button type="button" disabled={act.isPending || !!disabled}
                          onClick={() => setConfirm(isAdminUser
                            ? { title: `Remove ${name}'s Administrator role?`, body: "They keep their companies and roles in each product, but lose the Access Center, Executive Hub and system settings. They are signed out.", action: "Remove role", danger: true, type: name, run: () => accessApi.systemRole(u.id, "USER") }
                            : { title: `Make ${name} a Co-Administrator?`, body: "They will see and control EVERYTHING: every company in every product, the Access Center, Executive Hub and system settings. Only do this for someone you trust like yourself.", action: "Make Co-Administrator", danger: true, type: name, run: () => accessApi.systemRole(u.id, "SUPER_ADMIN") })}
                          className={cn("h-8 rounded-lg px-3 text-[12.5px] font-semibold disabled:opacity-40", isAdminUser ? "border border-border hover:bg-accent" : "bg-forest text-white dark:bg-primary")}>{isAdminUser ? "Remove role" : "Make Co-Admin"}</button>
                      </div>
                    </Card>
                    {!isAdminUser && <ManagerScopes userId={u.id} scopes={u.managerScopes ?? []} companies={companies} />}
                    <Card>
                      <div className="flex items-center gap-3">
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white", disabled ? "bg-[#047857]" : "bg-[#dc2626]")}>{disabled ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}</span>
                        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">{disabled ? "Account disabled" : "Account"}</span><span className="block text-[11.5px] text-muted-foreground">{disabled ? "They can't sign in. Their companies and roles are kept." : "Disabling signs them out everywhere at once."}</span></span>
                        {disabled
                          ? <button type="button" onClick={() => run(() => accessApi.enable(u.id), "Account enabled")} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-white dark:bg-primary">Enable</button>
                          : <button type="button" disabled={isAdminUser || u.id === undefined} onClick={() => setConfirm({ title: `Disable ${name}?`, body: <>They are signed out everywhere and can't sign in. Their EZ Tracker computers and EZ Vault browser extensions stop working, and they leave shared vaults (unless they are a vault's only owner). Companies and roles are kept, so enabling restores them.</>, action: "Disable", danger: true, type: name, run: () => accessApi.disable(u.id) })} className="h-8 rounded-lg border border-[#dc2626]/40 px-3 text-[12.5px] font-semibold text-[#dc2626] hover:bg-[#dc2626]/10 disabled:opacity-40" title={isAdminUser ? "Remove the Administrator role first" : undefined}>Disable</button>}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <Confirm open={!!confirm} title={confirm?.title ?? ""} body={confirm?.body} action={confirm?.action ?? ""} danger={confirm?.danger} typeToConfirm={confirm?.type} busy={act.isPending}
          onClose={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c) run(c.run, "Done"); }} />
      </SheetContent>
    </Sheet>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_2px_rgb(11_42_31/0.04)]">{children}</section>;
}

function Companies({ rows, product, roles, grantAdmin, busy, onRole, onRemove }: {
  rows: { id: number; name: string; role: string; extra?: string }[]; product: ProductKey; roles: string[]; grantAdmin: (ws: number) => boolean; busy: boolean;
  onRole: (ws: number, role: string) => void; onRemove: (ws: number, name: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70">
      {rows.map((r) => {
        const owner = r.role === "OWNER";
        const canAdmin = grantAdmin(r.id);
        const locked = owner || (!canAdmin && ["ADMIN"].includes(r.role));
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="min-w-[150px] flex-1"><span className="block truncate text-[13px] font-medium" title={r.name}>{r.name}</span><span className="block text-[11px] text-muted-foreground">{r.extra ? `${r.extra} · ` : ""}role counts in {PRODUCT_META[product].short} only</span></span>
            {locked ? <RoleChip role={r.role} product={product} /> : (
              <select value={r.role} disabled={busy} onChange={(e) => onRole(r.id, e.target.value)} aria-label={`Role in ${r.name}`} className={sel}>
                {roles.filter((x) => x !== "ADMIN" || canAdmin).map((x) => <option key={x} value={x}>{roleLabel(x)}</option>)}
              </select>
            )}
            {!locked && <button type="button" disabled={busy} onClick={() => onRemove(r.id, r.name)} aria-label={`Remove from ${r.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#dc2626]/10 hover:text-[#dc2626]"><Trash2 className="h-3.5 w-3.5" /></button>}
          </li>
        );
      })}
    </ul>
  );
}

function AddCompany({ product, options, roles, busy, onAdd }: {
  product: "accounts" | "work"; options: { id: number; name: string; mayGrantAdmin: boolean; boards?: { id: number; name: string }[] }[]; roles: string[]; busy: boolean;
  onAdd: (ws: number, role: string, boards?: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ws, setWs] = useState<number | "">("");
  const [role, setRole] = useState("MEMBER");
  const [boards, setBoards] = useState<number[]>([]);
  const picked = options.find((o) => o.id === ws);
  if (!options.length) return null;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary/10"><Plus className="h-3.5 w-3.5" /> Add to company…</button>;
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select value={ws} onChange={(e) => { setWs(e.target.value ? Number(e.target.value) : ""); setBoards([]); }} aria-label="Company" className={cn(sel, "min-w-0 flex-1")}>
          <option value="">Pick a company…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className={sel}>
          {roles.filter((x) => x !== "ADMIN" || picked?.mayGrantAdmin !== false).map((x) => <option key={x} value={x}>{roleLabel(x)}</option>)}
        </select>
      </div>
      {product === "accounts" && picked?.boards && picked.boards.length > 0 && (
        <div>
          <p className="mb-1 text-[11.5px] text-muted-foreground">Boards {boards.length ? `(${boards.length})` : "(all)"}</p>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
            {picked.boards.map((b) => { const on = boards.includes(b.id); return <button key={b.id} type="button" aria-pressed={on} onClick={() => setBoards((x) => on ? x.filter((y) => y !== b.id) : [...x, b.id])} className={cn("rounded-md px-2 py-0.5 text-[11.5px] ring-1", on ? "bg-primary/10 text-primary ring-primary/30" : "ring-border hover:bg-accent")}>{b.name}</button>; })}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-lg px-3 text-[12.5px] text-muted-foreground hover:bg-accent">Cancel</button>
        <button type="button" disabled={!ws || busy} onClick={() => { onAdd(Number(ws), role, boards.length ? boards : undefined); setOpen(false); setWs(""); setBoards([]); }} className="flex h-8 items-center gap-1 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-primary">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add</button>
      </div>
    </div>
  );
}

function ManagerScopes({ userId, scopes, companies }: { userId: number; scopes: ManagerScope[]; companies?: AccessCompanies }) {
  const qc = useQueryClient();
  const [list, setList] = useState<ManagerScope[]>(scopes);
  const [product, setProduct] = useState<"accounts" | "work">("accounts");
  const [ws, setWs] = useState<number | "">("");
  const dirty = JSON.stringify(list) !== JSON.stringify(scopes);
  const save = useMutation({
    mutationFn: () => accessApi.setScopes(userId, list),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["access"] }); toast.success(list.length ? "Access Manager saved" : "Access Manager role removed"); },
    onError: (e) => toast.error(errText(e)),
  });
  const nameOf = (s: ManagerScope) => (s.product === "work" ? companies?.work.find((c) => c.id === s.workspaceId)?.name : companies?.accounts.find((c) => c.id === s.workspaceId)?.name) ?? `#${s.workspaceId}`;
  const opts = product === "work" ? companies?.work ?? [] : companies?.accounts ?? [];
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-brass-soft dark:bg-primary"><ShieldCheck className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold">Access Manager</span><span className="block text-[11.5px] text-muted-foreground">Can invite and manage people only in these companies. No extra access to their boards, tasks or data.</span></span>
      </div>
      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70">
          {list.map((s, i) => (
            <li key={`${s.product}-${s.workspaceId}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-white" style={{ background: PRODUCT_META[s.product].color }}>{PRODUCT_META[s.product].short}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{nameOf(s)}</span>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><input type="checkbox" checked={s.mayGrantAdmin} onChange={(e) => setList((x) => x.map((y, j) => j === i ? { ...y, mayGrantAdmin: e.target.checked } : y))} /> may grant Admin</label>
              <button type="button" aria-label="Remove company" onClick={() => setList((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-[#dc2626]/10 hover:text-[#dc2626]"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={product} onChange={(e) => { setProduct(e.target.value as any); setWs(""); }} aria-label="Product" className={sel}><option value="accounts">Accounts &amp; Invoices</option><option value="work">Company Work</option></select>
        <select value={ws} onChange={(e) => setWs(e.target.value ? Number(e.target.value) : "")} aria-label="Company" className={cn(sel, "min-w-0 flex-1")}>
          <option value="">Pick a company…</option>
          {opts.filter((o) => !list.some((s) => s.product === product && s.workspaceId === o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button type="button" disabled={!ws} onClick={() => { setList((x) => [...x, { product, workspaceId: Number(ws), source: null, mayGrantAdmin: false }]); setWs(""); }} className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12.5px] font-semibold disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Add</button>
        <span className="flex-1" />
        <button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()} className="h-8 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-white disabled:opacity-40 dark:bg-primary">Save</button>
      </div>
    </Card>
  );
}
