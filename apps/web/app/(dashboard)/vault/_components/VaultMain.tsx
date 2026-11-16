"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, CreditCard, ExternalLink, Eye, EyeOff, FileText, Globe, IdCard, Layers, Lock, Pencil, Plus, Search, Settings, ShieldAlert, Star, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as C from "@/lib/vault/vault-crypto";
import { BrandMark } from "@/app/layouts/AppShell/Sidebar/ProductNav";
import { errMsg, typeLabel, updateItem, useVault, vaultApi, type Item, type ItemType } from "../_lib/session";
import { ago, CopyButton, ItemIcon, strengthMeta, TotpCode } from "./bits";
import { ItemEditor } from "./ItemEditor";
import { NewVaultDialog, ShareVault } from "./ShareVault";
import { ActivityView, SecurityView, SettingsView, TrashView } from "./Views";

export type Nav = { kind: "all" } | { kind: "favorites" } | { kind: "type"; type: ItemType } | { kind: "vault"; uid: string } | { kind: "security" } | { kind: "activity" } | { kind: "trash" } | { kind: "settings" };
const TYPES: { type: ItemType; label: string; icon: typeof Globe }[] = [
  { type: "login", label: "Logins", icon: Globe },
  { type: "note", label: "Secure notes", icon: FileText },
  { type: "card", label: "Cards", icon: CreditCard },
  { type: "identity", label: "Identities", icon: IdCard },
];

export function VaultMain() {
  const { vaults, items, me, lock, broken, trash } = useVault();
  const [nav, setNav] = useState<Nav>({ kind: "all" });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [newVault, setNewVault] = useState(false);
  const [share, setShare] = useState<string | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = items;
    if (nav.kind === "favorites") r = r.filter((i) => i.data.favorite);
    if (nav.kind === "type") r = r.filter((i) => i.data.type === nav.type);
    if (nav.kind === "vault") r = r.filter((i) => i.vaultUid === nav.uid);
    if (term) r = r.filter((i) => `${i.data.title} ${i.data.username ?? ""} ${(i.data.urls ?? []).join(" ")} ${(i.data.tags ?? []).join(" ")}`.toLowerCase().includes(term));
    return [...r].sort((a, b) => a.data.title.localeCompare(b.data.title));
  }, [items, nav, q]);
  const listMode = ["all", "favorites", "type", "vault"].includes(nav.kind);
  const current = items.find((i) => i.uid === sel) ?? (listMode ? list[0] : undefined);
  const curVault = nav.kind === "vault" ? vaults.find((v) => v.uid === nav.uid) : undefined;
  const canWriteSomewhere = vaults.some((v) => v.role !== "viewer");
  const go = (n: Nav) => { setNav(n); setSel(null); };

  const NavBtn = ({ n, icon: Icon, label, count, active }: { n: Nav; icon: typeof Globe; label: string; count?: number; active: boolean }) => (
    <button type="button" aria-current={active ? "page" : undefined} onClick={() => go(n)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px]", active ? "bg-product-vault/10 font-semibold text-foreground" : "text-foreground/80 hover:bg-accent/60")}>
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-product-vault" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="font-mono text-[11px] text-muted-foreground">{count}</span>}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link href="/home" className="flex items-center gap-2.5" aria-label="EZ Manage home"><BrandMark size={30} /></Link>
        <span className="hidden font-serif text-[20px] sm:block">EZ Vault</span>
        <label className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!listMode) go({ kind: "all" }); }} placeholder="Search EZ Vault" aria-label="Search EZ Vault" className="w-full bg-transparent text-[13.5px] outline-none" />
        </label>
        {canWriteSomewhere && <button type="button" onClick={() => setEditing("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New item</button>}
        <button type="button" onClick={() => { lock(); toast("EZ Vault locked"); }} aria-label="Lock EZ Vault" title="Lock" className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] hover:bg-accent"><Lock className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Vault navigation" className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card/60 p-3 md:block">
          <NavBtn n={{ kind: "all" }} icon={Layers} label="All items" count={items.length} active={nav.kind === "all"} />
          <NavBtn n={{ kind: "favorites" }} icon={Star} label="Favorites" count={items.filter((i) => i.data.favorite).length} active={nav.kind === "favorites"} />
          <p className="mb-1 mt-4 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Categories</p>
          {TYPES.map((t) => <NavBtn key={t.type} n={{ kind: "type", type: t.type }} icon={t.icon} label={t.label} count={items.filter((i) => i.data.type === t.type).length} active={nav.kind === "type" && nav.type === t.type} />)}
          <div className="mb-1 mt-4 flex items-center px-2.5">
            <p className="flex-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Vaults</p>
            <button type="button" aria-label="New shared vault" title="New shared vault" onClick={() => setNewVault(true)} className="rounded p-0.5 text-muted-foreground hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {vaults.map((v) => <NavBtn key={v.uid} n={{ kind: "vault", uid: v.uid }} icon={v.kind === "personal" ? Lock : Users} label={v.name} count={items.filter((i) => i.vaultUid === v.uid).length} active={nav.kind === "vault" && nav.uid === v.uid} />)}
          <div className="mt-4 border-t border-border pt-3">
            <NavBtn n={{ kind: "security" }} icon={ShieldAlert} label="Security check" active={nav.kind === "security"} />
            <NavBtn n={{ kind: "activity" }} icon={Activity} label="Activity" active={nav.kind === "activity"} />
            <NavBtn n={{ kind: "trash" }} icon={Trash2} label="Trash" count={trash.length} active={nav.kind === "trash"} />
            <NavBtn n={{ kind: "settings" }} icon={Settings} label="Settings" active={nav.kind === "settings"} />
          </div>
          {me && <p className="mt-4 truncate px-2.5 text-[11.5px] text-muted-foreground">{me.user.email}</p>}
        </aside>

        {/* mobile nav */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
            {([["All", { kind: "all" }], ["Favorites", { kind: "favorites" }], ["Security", { kind: "security" }], ["Activity", { kind: "activity" }], ["Trash", { kind: "trash" }], ["Settings", { kind: "settings" }]] as [string, Nav][]).map(([l, n]) => (
              <button key={l} type="button" onClick={() => go(n)} className={cn("shrink-0 rounded-full px-3 py-1 text-[12.5px]", nav.kind === n.kind ? "bg-product-vault/15 font-semibold" : "text-muted-foreground")}>{l}</button>
            ))}
          </div>
          {broken > 0 && <p className="border-b border-[#b45309]/30 bg-[#b45309]/5 px-4 py-2 text-[12.5px]">{broken} item{broken > 1 ? "s" : ""} couldn&apos;t be opened right now (a vault key just changed). <button type="button" onClick={() => useVault.getState().reload()} className="font-semibold underline">Reload</button></p>}

          {nav.kind === "security" ? <SecurityView onOpen={(uid) => { setNav({ kind: "all" }); setSel(uid); }} /> :
            nav.kind === "activity" ? <ActivityView /> :
            nav.kind === "trash" ? <TrashView /> :
            nav.kind === "settings" ? <SettingsView /> : (
            <div className="flex min-h-0 flex-1">
              <section aria-label="Items" className={cn("flex min-h-0 w-full flex-col border-r border-border md:w-[340px] md:shrink-0", current && "hidden md:flex")}>
                {curVault && (
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{curVault.name}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{curVault.kind === "personal" ? "Only you" : `${curVault.members} ${curVault.members === 1 ? "person" : "people"} · you are ${curVault.role}`}</span>
                    </span>
                    {curVault.kind === "shared" && <button type="button" onClick={() => setShare(curVault.uid)} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] hover:bg-accent"><Users className="h-3.5 w-3.5" /> People</button>}
                  </div>
                )}
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {!list.length && <li className="px-6 py-16 text-center text-[13px] text-muted-foreground">{q ? "Nothing matches." : "No items here yet."}{!q && canWriteSomewhere && <><br /><button type="button" onClick={() => setEditing("new")} className="mt-2 font-semibold text-primary hover:underline">Add your first item</button></>}</li>}
                  {list.map((i) => (
                    <li key={i.uid}>
                      <button type="button" aria-current={current?.uid === i.uid ? "true" : undefined} onClick={() => setSel(i.uid)} className={cn("flex w-full items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left", current?.uid === i.uid ? "bg-product-vault/8" : "hover:bg-accent/40")}>
                        <ItemIcon item={i} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold">{i.data.title}{i.data.favorite && <Star className="h-3 w-3 shrink-0 fill-[#b08d57] text-[#b08d57]" />}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">{i.data.type === "login" ? i.data.username || C.hostOf(i.data.urls?.[0] ?? "") : i.data.type === "card" ? (i.data.card?.number ? `•••• ${i.data.card.number.replace(/\s/g, "").slice(-4)}` : "Card") : typeLabel[i.data.type]}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-label="Item details" className={cn("min-h-0 flex-1 overflow-y-auto", !current && "hidden md:block")}>
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
    <div className="border-b border-border/70 px-4 py-2.5 last:border-b-0">
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

function ItemDetail({ item, onEdit, onBack }: { item: Item; onEdit: () => void; onBack: () => void }) {
  const { vaults } = useVault();
  const v = vaults.find((x) => x.uid === item.vaultUid);
  const d = item.data;
  const canEdit = v?.role !== "viewer";
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
            <button type="button" onClick={onEdit} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] hover:bg-accent"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" aria-label="Move to trash" onClick={remove} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        {d.type === "login" && (
          <>
            {d.username && <Field label="Username"><span className="min-w-0 flex-1 break-all">{d.username}</span><CopyButton text={d.username} what="Username" item={item} field="username" /></Field>}
            {d.password && (
              <Field label="Password">
                <Secret item={item} value={d.password} field="password" what="Password" />
              </Field>
            )}
            {d.password && <div className="flex items-center gap-2 px-4 pb-2.5 text-[11.5px]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: strengthMeta(s).color }} /><span style={{ color: strengthMeta(s).color }}>{strengthMeta(s).label}</span>{d.passwordUpdatedAt && <span className="text-muted-foreground">· changed {ago(d.passwordUpdatedAt)}</span>}</div>}
            {d.totp && <Field label="One-time code (2FA)"><TotpCode secret={d.totp} item={item} /></Field>}
            {(d.urls ?? []).filter(Boolean).map((u, i) => (
              <Field key={i} label={i ? "Website" : "Website"}>
                <span className="min-w-0 flex-1 truncate text-primary">{u}</span>
                <a href={/^https?:\/\//.test(u) ? u : `https://${u}`} target="_blank" rel="noreferrer noopener" aria-label="Open website" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"><ExternalLink className="h-4 w-4" /></a>
              </Field>
            ))}
          </>
        )}
        {d.type === "card" && d.card && (
          <>
            {d.card.holder && <Field label="Cardholder"><span className="flex-1">{d.card.holder}</span></Field>}
            {d.card.number && <Field label="Number"><Secret item={item} value={d.card.number} field="number" what="Card number" /></Field>}
            {d.card.expiry && <Field label="Expires"><span className="flex-1">{d.card.expiry}</span></Field>}
            {d.card.cvv && <Field label="Security code"><Secret item={item} value={d.card.cvv} field="cvv" what="Security code" /></Field>}
            {d.card.pin && <Field label="PIN"><Secret item={item} value={d.card.pin} field="pin" what="PIN" /></Field>}
          </>
        )}
        {d.type === "identity" && d.identity && (
          <>
            {(["fullName", "email", "phone", "company", "address"] as const).filter((k) => d.identity?.[k]).map((k) => (
              <Field key={k} label={{ fullName: "Full name", email: "Email", phone: "Phone", company: "Company", address: "Address" }[k]}><span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{d.identity![k]}</span><CopyButton text={d.identity![k]!} what={k === "fullName" ? "Name" : k} item={item} field={k} /></Field>
            ))}
          </>
        )}
        {d.notes && <Field label={d.type === "note" ? "Note" : "Notes"}><p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13.5px]">{d.notes}</p></Field>}
        {d.type === "note" && !d.notes && <Field label="Note"><span className="text-muted-foreground">Empty</span></Field>}
      </div>
      {!!d.tags?.length && <p className="mt-3 flex flex-wrap gap-1.5">{d.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{t}</span>)}</p>}
      <p className="mt-4 text-[11.5px] text-muted-foreground">Created {ago(item.createdAt)} · last edited {ago(item.updatedAt)}</p>
    </article>
  );
}
