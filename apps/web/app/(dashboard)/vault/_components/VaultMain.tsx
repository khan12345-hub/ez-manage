"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, Building2, CreditCard, ExternalLink, Eye, EyeOff, FileText, Fingerprint, Gauge, Globe, IdCard, KeyRound, LayoutDashboard, Layers, LifeBuoy, Lock, Pencil, Plus, Search, Settings, ShieldAlert, ShieldCheck, Siren, Star, Tag, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { AppSwitcher } from "@/components/AppSwitcher";
import { canReveal, canWrite, errMsg, ROLE_LABEL, typeLabel, updateItem, useVault, vaultApi, type Item, type ItemType } from "../_lib/session";
import { ItemHistory, RotationsPanel } from "./Team";
import { AdminView } from "./Admin";
import { ago, CopyButton, ItemIcon, strengthMeta, TotpCode } from "./bits";
import { ItemEditor } from "./ItemEditor";
import { NewVaultDialog, ShareVault } from "./ShareVault";
import { ActivityView, AlertsView, SecurityView, SettingsView, TrashView } from "./Views";
import { TeamView } from "./Team";
import { OverviewView } from "./Overview";
import { PeopleView } from "./People";
import { EmergencyView } from "./Emergency";
import { Backdrop, GLASS } from "./ui";

export type Nav = { kind: "overview" } | { kind: "all" } | { kind: "favorites" } | { kind: "type"; type: ItemType } | { kind: "vault"; uid: string } | { kind: "tag"; tag: string } | { kind: "security" } | { kind: "activity" } | { kind: "alerts" } | { kind: "people" } | { kind: "emergency" } | { kind: "trash" } | { kind: "settings" } | { kind: "team" } | { kind: "admin" };
const TYPES: { type: ItemType; label: string; icon: typeof Globe }[] = [
  { type: "login", label: "Logins", icon: Globe },
  { type: "passkey", label: "Passkeys", icon: Fingerprint },
  { type: "note", label: "Secure notes", icon: FileText },
  { type: "card", label: "Cards", icon: CreditCard },
  { type: "identity", label: "Identities", icon: IdCard },
];

export function VaultMain() {
  const { vaults, items, me, lock, broken, trash } = useVault();
  const [nav, setNav] = useState<Nav>({ kind: "overview" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [newVault, setNewVault] = useState(false);
  const [share, setShare] = useState<string | null>(null);

  // Deep-links the browser extension opens:
  //  ?connect=extension → Settings (it auto-connects there; the flag stays for SettingsView)
  //  ?new=login         → the new-item editor
  //  ?item=<uid>        → open that item
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("connect") === "extension") { setNav({ kind: "settings" }); return; }
    if (p.has("new")) { setNav({ kind: "all" }); setEditing("new"); }
    else { const uid = p.get("item"); if (uid) { setNav({ kind: "all" }); setSel(uid); } }
    if (p.has("new") || p.has("item")) { const u = new URL(window.location.href); u.searchParams.delete("new"); u.searchParams.delete("item"); window.history.replaceState({}, "", u.toString()); }
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = items;
    if (nav.kind === "favorites") r = r.filter((i) => i.data.favorite);
    if (nav.kind === "type") r = r.filter((i) => i.data.type === nav.type);
    if (nav.kind === "vault") r = r.filter((i) => i.vaultUid === nav.uid);
    if (nav.kind === "tag") r = r.filter((i) => (i.data.tags ?? []).includes(nav.tag));
    if (term) r = r.filter((i) => `${i.data.title} ${i.data.username ?? ""} ${(i.data.urls ?? []).join(" ")} ${(i.data.tags ?? []).join(" ")}`.toLowerCase().includes(term));
    return [...r].sort((a, b) => a.data.title.localeCompare(b.data.title));
  }, [items, nav, q]);
  const listMode = ["all", "favorites", "type", "vault", "tag"].includes(nav.kind);
  // all tags across items (for the sidebar), most-used first
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) for (const t of i.data.tags ?? []) if (t.trim()) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);
  const current = items.find((i) => i.uid === sel) ?? (listMode ? list[0] : undefined);
  const curVault = nav.kind === "vault" ? vaults.find((v) => v.uid === nav.uid) : undefined;
  const canWriteSomewhere = vaults.some((v) => canWrite(v.role));
  const go = (n: Nav) => { setNav(n); setSel(null); };
  const open = (uid: string) => { setNav({ kind: "all" }); setSel(uid); };

  const NavBtn = ({ n, icon: Icon, label, count, active }: { n: Nav; icon: typeof Globe; label: string; count?: number; active: boolean }) => (
    <button type="button" aria-current={active ? "page" : undefined} onClick={() => go(n)}
      className={cn("group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-left text-[13.5px] font-medium transition-all",
        active ? "bg-forest text-white shadow-[0_10px_24px_-14px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5")}>
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition", active ? "bg-white/10 text-brass-soft" : "bg-white/60 text-muted-foreground group-hover:text-foreground dark:bg-white/5")}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className={cn("font-mono text-[11px]", active ? "text-white/70" : "text-muted-foreground")}>{count}</span>}
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#eef3f0] dark:bg-background">
      <Backdrop />
      <header className="relative z-20 flex items-center gap-3 border-b border-white/60 bg-white/55 px-4 py-2.5 backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03]">
        <div className="w-[230px] shrink-0 max-sm:w-auto"><AppSwitcher active="vault" subtitle="Password manager" className="max-sm:[&>span:nth-child(2)]:hidden" /></div>
        <label className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 shadow-sm dark:border-white/10 dark:bg-white/5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!listMode) go({ kind: "all" }); }} placeholder="Search EZ Vault" aria-label="Search EZ Vault" className="w-full bg-transparent text-[13.5px] outline-none" />
        </label>
        {canWriteSomewhere && <button type="button" onClick={() => setEditing("new")} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[13px] font-semibold text-forest-foreground shadow-[0_10px_24px_-14px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New item</button>}
        <button type="button" onClick={() => { lock(); toast("EZ Vault locked"); }} aria-label="Lock EZ Vault" title="Lock" className="flex h-9 items-center gap-1.5 rounded-xl border border-white/70 bg-white/70 px-3 text-[13px] hover:bg-white dark:border-white/10 dark:bg-white/5"><Lock className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside aria-label="Vault navigation" className="hidden w-[244px] shrink-0 p-3 md:block">
          <div className="flex h-full flex-col overflow-y-auto rounded-[24px] border border-white/70 bg-white/60 p-2.5 shadow-[0_20px_60px_-24px_rgba(11,42,31,0.35)] ring-1 ring-black/[0.03] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
            <NavBtn n={{ kind: "overview" }} icon={LayoutDashboard} label="Overview" active={nav.kind === "overview"} />
            <NavBtn n={{ kind: "all" }} icon={Layers} label="All items" count={items.length} active={nav.kind === "all"} />
            <NavBtn n={{ kind: "favorites" }} icon={Star} label="Favorites" count={items.filter((i) => i.data.favorite).length} active={nav.kind === "favorites"} />
            <p className="mb-1 mt-3 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Categories</p>
            {TYPES.map((t) => <NavBtn key={t.type} n={{ kind: "type", type: t.type }} icon={t.icon} label={t.label} count={items.filter((i) => i.data.type === t.type).length} active={nav.kind === "type" && nav.type === t.type} />)}
            <div className="mb-1 mt-3 flex items-center px-2.5">
              <p className="flex-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Vaults</p>
              <button type="button" aria-label="New shared vault" title="New shared vault" onClick={() => setNewVault(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            {vaults.map((v) => <NavBtn key={v.uid} n={{ kind: "vault", uid: v.uid }} icon={v.kind === "personal" ? Lock : v.company ? Building2 : Users} label={v.name} count={items.filter((i) => i.vaultUid === v.uid).length} active={nav.kind === "vault" && nav.uid === v.uid} />)}
            {tags.length > 0 && (
              <>
                <p className="mb-1 mt-3 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tags</p>
                {tags.slice(0, 12).map(([t, n]) => <NavBtn key={t} n={{ kind: "tag", tag: t }} icon={Tag} label={t} count={n} active={nav.kind === "tag" && nav.tag === t} />)}
              </>
            )}
            <div className="mt-3 space-y-0.5 border-t border-black/[0.06] pt-3 dark:border-white/10">
              <NavBtn n={{ kind: "security" }} icon={ShieldAlert} label="Watchtower" active={nav.kind === "security"} />
              <NavBtn n={{ kind: "activity" }} icon={Activity} label="Activity" active={nav.kind === "activity"} />
              <NavBtn n={{ kind: "alerts" }} icon={Siren} label="Unusual activity" active={nav.kind === "alerts"} />
              <NavBtn n={{ kind: "people" }} icon={Users} label="People" active={nav.kind === "people"} />
              <NavBtn n={{ kind: "emergency" }} icon={LifeBuoy} label="Emergency access" active={nav.kind === "emergency"} />
              <NavBtn n={{ kind: "trash" }} icon={Trash2} label="Trash" count={trash.length} active={nav.kind === "trash"} />
              <NavBtn n={{ kind: "settings" }} icon={Settings} label="Settings" active={nav.kind === "settings"} />
              {me?.isVaultAdmin && <NavBtn n={{ kind: "team" }} icon={Gauge} label="Team" active={nav.kind === "team"} />}
              {me?.isVaultAdmin && <NavBtn n={{ kind: "admin" }} icon={ShieldCheck} label="Vault admin" active={nav.kind === "admin"} />}
            </div>
            {me && <p className="mt-3 truncate px-2.5 text-[11.5px] text-muted-foreground">{me.user.email}</p>}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* mobile nav */}
          <div className="flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
            {([["Overview", { kind: "overview" }], ["All", { kind: "all" }], ["Favorites", { kind: "favorites" }], ["Watchtower", { kind: "security" }], ["Activity", { kind: "activity" }], ["Unusual", { kind: "alerts" }], ["People", { kind: "people" }], ["Emergency", { kind: "emergency" }], ["Trash", { kind: "trash" }], ["Settings", { kind: "settings" }], ...(me?.isVaultAdmin ? [["Team", { kind: "team" }], ["Vault admin", { kind: "admin" }]] : [])] as [string, Nav][]).map(([l, n]) => (
              <button key={l} type="button" onClick={() => go(n)} className={cn("shrink-0 rounded-full px-3 py-1 text-[12.5px] font-semibold", nav.kind === n.kind ? "bg-forest text-white dark:bg-primary" : "bg-white/70 text-muted-foreground dark:bg-white/5")}>{l}</button>
            ))}
          </div>
          {broken > 0 && <p className="relative z-10 mx-3 mb-1 rounded-xl border border-[#b45309]/30 bg-[#b45309]/5 px-4 py-2 text-[12.5px] md:mx-3">{broken} item{broken > 1 ? "s" : ""} couldn&apos;t be opened right now (a vault key just changed). <button type="button" onClick={() => useVault.getState().reload()} className="font-semibold underline">Reload</button></p>}

          {nav.kind === "overview" ? <OverviewView onOpen={open} onNav={go} /> :
            nav.kind === "security" ? <SecurityView onOpen={(uid) => { setNav({ kind: "all" }); setSel(uid); }} /> :
            nav.kind === "activity" ? <ActivityView /> :
            nav.kind === "alerts" ? <AlertsView /> :
            nav.kind === "people" ? <PeopleView onNav={go} /> :
            nav.kind === "emergency" ? <EmergencyView /> :
            nav.kind === "trash" ? <TrashView /> :
            nav.kind === "settings" ? <SettingsView /> :
            nav.kind === "team" ? <TeamView /> :
            nav.kind === "admin" ? <AdminView onOpenVault={(uid) => go({ kind: "vault", uid })} /> : (
            <div className="flex min-h-0 flex-1 p-3 pt-0 md:pl-0">
              <section aria-label="Items" className={cn("flex min-h-0 w-full flex-col overflow-hidden md:w-[348px] md:shrink-0", GLASS, current && "hidden md:flex")}>
                {curVault ? (
                  <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest text-brass-soft">{curVault.kind === "personal" ? <Lock className="h-4 w-4" /> : curVault.company ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{curVault.name}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{curVault.kind === "personal" ? "Only you" : `${curVault.company ? `${curVault.company.name} · ` : ""}${curVault.members} ${curVault.members === 1 ? "person" : "people"} · you: ${ROLE_LABEL[curVault.role]}`}</span>
                    </span>
                    {curVault.kind === "shared" && <button type="button" onClick={() => setShare(curVault.uid)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] hover:bg-accent"><Users className="h-3.5 w-3.5" /> People</button>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10">
                    <span className="min-w-0 flex-1 text-[14px] font-semibold">{nav.kind === "favorites" ? "Favorites" : nav.kind === "type" ? TYPES.find((t) => t.type === nav.type)?.label : nav.kind === "tag" ? `#${nav.tag}` : "All items"}</span>
                    <span className="font-mono text-[11.5px] text-muted-foreground">{list.length}</span>
                  </div>
                )}
                {curVault?.role === "owner" && curVault.kind === "shared" && <RotationsPanel vaultUid={curVault.uid} onOpen={(uid) => setSel(uid)} />}
                <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
                  {!list.length && <li className="px-6 py-16 text-center text-[13px] text-muted-foreground">{q ? "Nothing matches." : "No items here yet."}{!q && canWriteSomewhere && <><br /><button type="button" onClick={() => setEditing("new")} className="mt-2 font-semibold text-primary hover:underline">Add your first item</button></>}</li>}
                  {list.map((i) => (
                    <li key={i.uid}>
                      <button type="button" aria-current={current?.uid === i.uid ? "true" : undefined} onClick={() => setSel(i.uid)} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", current?.uid === i.uid ? "bg-product-vault/10 shadow-sm" : "hover:bg-white/70 dark:hover:bg-white/5")}>
                        <ItemIcon item={i} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">{i.data.title}{i.data.favorite && <Star className="h-3 w-3 shrink-0 fill-[#b08d57] text-[#b08d57]" />}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="min-w-0 truncate text-[12px] text-muted-foreground">{i.data.type === "login" ? i.data.username || C.hostOf(i.data.urls?.[0] ?? "") : i.data.type === "card" ? (i.data.card?.number ? `•••• ${i.data.card.number.replace(/\s/g, "").slice(-4)}` : "Card") : typeLabel[i.data.type]}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="rounded-full bg-black/[0.04] px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-white/10">{typeLabel[i.data.type]}</span>
                          <span className="text-[10.5px] text-muted-foreground">{ago(i.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label="Item details" className={cn("ml-3 min-h-0 flex-1 overflow-y-auto rounded-[24px] max-md:ml-0", !current ? "hidden md:block" : GLASS)}>
                {current ? <ItemDetail key={current.uid} item={current} onEdit={() => setEditing(current)} onBack={() => setSel(null)} /> : <p className="py-24 text-center text-[13px] text-muted-foreground">Pick an item.</p>}
              </section>
            </div>
          )}
        </div>
      </div>

      {editing && <ItemEditor item={editing === "new" ? null : editing} defaultVault={nav.kind === "vault" ? nav.uid : undefined} defaultType={nav.kind === "type" ? nav.type : undefined} onClose={() => setEditing(null)} onSaved={(uid) => { if (!uid) return; if (!listMode || (nav.kind !== "all" && nav.kind !== "vault")) setNav({ kind: "all" }); setQ(""); setSel(uid); }} />}
      {newVault && <NewVaultDialog onClose={() => setNewVault(false)} onMade={(uid) => { setNewVault(false); go({ kind: "vault", uid }); setShare(uid); }} />}
      {share && <ShareVault vaultUid={share} onClose={() => setShare(null)} onLeft={() => { setShare(null); go({ kind: "all" }); }} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5 last:border-b-0">
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex min-h-[28px] items-center gap-1 text-[14px]">{children}</div>
    </div>
  );
}

function Secret({ item, value, field, what }: { item: Item; value: string; field: string; what: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <span className={cn("min-w-0 flex-1 break-all", show ? "font-mono" : "tracking-[0.2em]")}>{show ? value : "••••••••••"}</span>
      <button type="button" aria-label={show ? `Hide ${what.toLowerCase()}` : `Show ${what.toLowerCase()}`} onClick={() => { if (!show) void vaultApi.event(item.uid, "revealed", field); setShow(!show); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
      <CopyButton text={value} what={what} item={item} field={field} />
    </>
  );
}

function UseOnlySecret({ what = "password" }: { what?: string }) {
  return <span className="flex min-w-0 flex-1 items-center gap-2"><span className="tracking-[0.2em]">••••••••••</span><span className="rounded-full bg-product-vault/10 px-2 py-0.5 text-[11px] font-medium text-product-vault" title={`You can use this login but not see its ${what}`}>Use only</span></span>;
}

function ItemDetail({ item, onEdit, onBack }: { item: Item; onEdit: () => void; onBack: () => void }) {
  const { vaults } = useVault();
  const v = vaults.find((x) => x.uid === item.vaultUid);
  const d = item.data;
  const canEdit = canWrite(v?.role);
  const useOnly = !canReveal(v?.role);
  const manager = v?.role === "owner" && v.kind === "shared";
  const s = d.password ? C.strength(d.password) : -1;
  const fav = async () => { try { await updateItem(item, { ...d, favorite: !d.favorite }); } catch (e) { toast.error(errMsg(e, "Couldn't save.")); } };
  const remove = async () => {
    if (!window.confirm(`Move "${d.title}" to the trash?`)) return;
    try { await api.delete(`/vault/items/${item.uid}`); await useVault.getState().reload(); toast.success("Moved to trash"); onBack(); } catch (e) { toast.error(errMsg(e, "Couldn't delete.")); }
  };
  return (
    <article className="mx-auto max-w-2xl p-5">
      <button type="button" onClick={onBack} className="mb-3 text-[13px] text-muted-foreground md:hidden">← Back</button>
      <div className="flex items-start gap-4">
        <ItemIcon item={item} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[26px] leading-tight">{d.title}</h1>
          <p className="text-[12.5px] text-muted-foreground">{typeLabel[d.type]} · {v?.name ?? "Vault"}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label={d.favorite ? "Remove from favorites" : "Add to favorites"} onClick={fav} className="rounded-md p-2 text-muted-foreground hover:bg-accent"><Star className={cn("h-4 w-4", d.favorite && "fill-[#b08d57] text-[#b08d57]")} /></button>
            <button type="button" onClick={onEdit} className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[13px] hover:bg-accent"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" aria-label="Move to trash" onClick={remove} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-[0_12px_32px_-26px_rgba(11,42,31,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        {d.type === "login" && (
          <>
            {d.username && <Field label="Username"><span className="min-w-0 flex-1 break-all">{d.username}</span><CopyButton text={d.username} what="Username" item={item} field="username" /></Field>}
            {d.password && (
              <Field label="Password">
                {useOnly ? <UseOnlySecret /> : <Secret item={item} value={d.password} field="password" what="Password" />}
              </Field>
            )}
            {d.password && <div className="flex items-center gap-2 px-4 pb-2.5 text-[11.5px]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: strengthMeta(s).color }} /><span style={{ color: strengthMeta(s).color }}>{strengthMeta(s).label}</span>{d.passwordUpdatedAt && <span className="text-muted-foreground">· changed {ago(d.passwordUpdatedAt)}</span>}</div>}
            {d.totp && <Field label="One-time code (2FA)"><TotpCode secret={d.totp} item={item} /></Field>}
            {(d.urls ?? []).filter(Boolean).map((u, i) => (
              <Field key={i} label="Website">
                <span className="min-w-0 flex-1 truncate text-primary">{u}</span>
                <a href={/^https?:\/\//.test(u) ? u : `https://${u}`} target="_blank" rel="noreferrer noopener" aria-label="Open website" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><ExternalLink className="h-4 w-4" /></a>
              </Field>
            ))}
          </>
        )}
        {d.type === "passkey" && d.passkey && (
          <>
            {d.passkey.rpId && <Field label="Website / app"><span className="min-w-0 flex-1 break-all">{d.passkey.rpId}</span><CopyButton text={d.passkey.rpId} what="Website" item={item} field="rpId" /></Field>}
            {d.passkey.username && <Field label="Username"><span className="min-w-0 flex-1 break-all">{d.passkey.username}</span><CopyButton text={d.passkey.username} what="Username" item={item} field="username" /></Field>}
            <Field label="Passkey">
              <span className="min-w-0 flex-1">
                {d.passkey.credentialId
                  ? <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-product-vault"><KeyRound className="h-3.5 w-3.5" /> Stored{d.passkey.createdAt ? ` · created ${new Date(d.passkey.createdAt).toLocaleDateString()}` : ""} · {d.passkey.alg ?? "ES256"}</span>
                  : <span className="text-muted-foreground">Not generated</span>}
              </span>
              {d.passkey.credentialId && <CopyButton text={d.passkey.credentialId} what="Credential ID" item={item} field="credentialId" />}
            </Field>
          </>
        )}
        {d.type === "card" && d.card && (
          <>
            {d.card.holder && <Field label="Cardholder"><span className="flex-1">{d.card.holder}</span></Field>}
            {d.card.number && <Field label="Number">{useOnly ? <UseOnlySecret /> : <Secret item={item} value={d.card.number} field="number" what="Card number" />}</Field>}
            {d.card.expiry && <Field label="Expires"><span className="flex-1">{d.card.expiry}</span></Field>}
            {d.card.cvv && <Field label="Security code">{useOnly ? <UseOnlySecret /> : <Secret item={item} value={d.card.cvv} field="cvv" what="Security code" />}</Field>}
            {d.card.pin && <Field label="PIN">{useOnly ? <UseOnlySecret /> : <Secret item={item} value={d.card.pin} field="pin" what="PIN" />}</Field>}
          </>
        )}
        {d.type === "identity" && d.identity && (
          <>
            {(["fullName", "email", "phone", "company", "address"] as const).filter((k) => d.identity?.[k]).map((k) => (
              <Field key={k} label={{ fullName: "Full name", email: "Email", phone: "Phone", company: "Company", address: "Address" }[k]}><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{d.identity![k]}</span><CopyButton text={d.identity![k]!} what={k === "fullName" ? "Name" : k} item={item} field={k} /></Field>
            ))}
          </>
        )}
        {d.notes && <Field label={d.type === "note" ? "Note" : "Notes"}>{useOnly ? <UseOnlySecret what="notes" /> : <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13.5px]">{d.notes}</p>}</Field>}
        {d.type === "note" && !d.notes && <Field label="Note"><span className="text-muted-foreground">Empty</span></Field>}
      </div>
      {!!d.tags?.length && <p className="mt-3 flex flex-wrap gap-1.5">{d.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{t}</span>)}</p>}
      {useOnly && <p className="mt-3 flex items-start gap-2 rounded-lg border border-product-vault/25 bg-product-vault/5 px-3 py-2 text-[12.5px]"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-product-vault" /><span><strong>Use only.</strong> Open the website and sign in with the EZ Vault browser extension — it fills the password for you. Showing, copying or exporting it is turned off for you, and every sign-in is recorded. (This is a strong guard in EZ Manage&rsquo;s apps, not encryption: please don&rsquo;t try to work around it.)</span></p>}
      {manager && <ItemHistory itemUid={item.uid} />}
      <p className="mt-4 text-[11.5px] text-muted-foreground">Created {ago(item.createdAt)} · last edited {ago(item.updatedAt)}</p>
    </article>
  );
}
