"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, ChevronDown, CircleDollarSign, Contact, Home, ListTodo, Menu, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSwitcher } from "@/components/AppSwitcher";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/providers/AuthProvider";
import { contactName, crmApi, fmtMoney } from "@/services/crm.api";
import { ago, useCrmWs } from "../_lib/crm";
import { Avatar } from "./bits";
import { CreateRecord, type CreateKind } from "./CreateRecord";

const NAV = [
  { path: "", label: "Home", icon: Home },
  { path: "contacts", label: "Contacts", icon: Contact },
  { path: "companies", label: "Companies", icon: Building2 },
  { path: "deals", label: "Deals", icon: CircleDollarSign },
  { path: "tasks", label: "Tasks", icon: ListTodo },
  { path: "settings", label: "Settings", icon: Settings },
] as const;

function GlobalSearch({ ws }: { ws: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const { data } = useQuery({ queryKey: ["crm", ws, "search", term], queryFn: () => crmApi.search(ws, term), enabled: term.length >= 2, staleTime: 10_000 });
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };
  const any = !!data && (data.contacts.length + data.companies.length + data.deals.length) > 0;
  return (
    <Popover open={open && term.length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <label className="flex h-10 w-full max-w-[420px] items-center gap-2 rounded-xl border border-border bg-background/80 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search contacts, companies, deals" aria-label="Search the CRM" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          <kbd className="hidden rounded-md border border-border px-1.5 text-[10.5px] text-muted-foreground sm:block">Ctrl K</kbd>
        </label>
      </PopoverTrigger>
      <PopoverContent align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="w-[var(--radix-popover-trigger-width)] rounded-2xl p-1.5">
        {!any ? <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">{data ? "Nothing found." : "Searching…"}</p> : (
          <div className="max-h-[360px] overflow-y-auto">
            {([["Contacts", data!.contacts.map((c) => ({ id: c.id, label: contactName(c), sub: c.email ?? "", href: `/crm/${ws}/contacts/${c.id}` }))],
              ["Companies", data!.companies.map((c) => ({ id: c.id, label: c.name, sub: c.domain ?? "", href: `/crm/${ws}/companies/${c.id}` }))],
              ["Deals", data!.deals.map((d) => ({ id: d.id, label: d.name, sub: fmtMoney(d.amount), href: `/crm/${ws}/deals/${d.id}` }))]] as const).map(([h, rows]) => rows.length > 0 && (
              <div key={h} className="py-1">
                <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</p>
                {rows.map((r) => <button key={r.id} type="button" onClick={() => go(r.href)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent"><span className="min-w-0 flex-1 truncate font-medium">{r.label}</span><span className="shrink-0 truncate text-[11.5px] text-muted-foreground">{r.sub}</span></button>)}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["crm", "notifications"], queryFn: crmApi.notifications, refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: crmApi.readNotifications, onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "notifications"] }) });
  return (
    <Popover onOpenChange={(o) => { if (!o && data?.unread) read.mutate(); }}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Notifications${data?.unread ? `, ${data.unread} new` : ""}`} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          {!!data?.unread && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#be185d] px-1 text-center text-[10px] font-bold leading-[18px] text-white">{data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-1.5">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Notifications</p>
        {!data?.items.length ? <p className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">Nothing yet. You&apos;ll hear here when a record or task is given to you.</p> : (
          <ul className="max-h-[360px] overflow-y-auto">
            {data.items.map((n) => (
              <li key={n.id}><button type="button" onClick={() => n.metadata?.href && router.push(n.metadata.href)} className={cn("flex w-full gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent", !n.isRead && "bg-[#be185d]/[0.05]")}>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#be185d]" />}
                <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{n.title}</span><span className="block truncate text-[12px] text-muted-foreground">{n.message}</span><span className="block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span></span>
              </button></li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const { uid, ws, isError } = useCrmWs();
  const { user } = useAuth();
  const pathname = usePathname() ?? "";
  const base = `/crm/${uid}`;
  const [menu, setMenu] = useState(false);
  const [create, setCreate] = useState<CreateKind | null>(null);
  const { data: list } = useQuery({ queryKey: ["crm", "workspaces"], queryFn: crmApi.workspaces, staleTime: 30_000 });
  const isOn = (p: string) => (p ? pathname.startsWith(`${base}/${p}`) : pathname === base);
  const title = NAV.find((n) => isOn(n.path))?.label ?? "CRM";
  useEffect(() => setMenu(false), [pathname]);

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <p className="text-[20px] font-semibold">This CRM isn&apos;t available</p>
        <p className="mt-1 text-[13px] text-muted-foreground">It doesn&apos;t exist, or you&apos;re not a member. Ask its owner to add you.</p>
        <Link href="/crm" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to EZ Sales</Link>
      </div>
    );
  }

  const nav = (
    <nav aria-label="EZ Sales" className="space-y-0.5">
      {NAV.map((n) => {
        if (n.path === "settings" && ws && !ws.canAdmin && ws.role === "VIEWER") return null;
        const on = isOn(n.path);
        return (
          <Link key={n.label} href={n.path ? `${base}/${n.path}` : base} aria-current={on ? "page" : undefined}
            className={cn("group flex items-center gap-3 rounded-2xl px-2.5 py-[7px] text-[13.5px] font-medium transition-all", on ? "bg-forest text-white shadow-[0_10px_24px_-12px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5")}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition", on ? "bg-white/10 text-brass-soft" : "bg-white/60 text-muted-foreground group-hover:text-foreground dark:bg-white/5")}><n.icon className="h-4 w-4" /></span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-white/60 p-3.5 shadow-[0_20px_60px_-24px_rgba(11,42,31,0.35)] ring-1 ring-black/[0.03] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.04]">
      <AppSwitcher active="crm" hrefs={{ crm: base }} subtitle={ws?.name ?? "Sales"} />
      {list && list.workspaces.length > 1 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="mt-3 flex h-10 w-full items-center gap-2 rounded-2xl bg-white/60 px-3 text-left text-[13px] font-medium ring-1 ring-black/[0.04] dark:bg-white/5"><span className="min-w-0 flex-1 truncate">{ws?.name ?? "…"}</span><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 rounded-xl p-1.5">
            {list.workspaces.map((w) => <Link key={w.uid} href={`/crm/${w.uid}`} className={cn("block rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent", w.uid === uid && "bg-accent font-semibold")}>{w.name}</Link>)}
            {list.canCreate && <Link href="/crm?new=1" className="mt-1 block rounded-lg border-t border-border px-2 py-1.5 text-[12.5px] text-muted-foreground hover:bg-accent">+ New CRM</Link>}
          </PopoverContent>
        </Popover>
      )}
      <p className="mb-1.5 mt-5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sales</p>
      {nav}
      <div className="mt-auto pt-5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/60 p-2.5 ring-1 ring-black/[0.04] dark:bg-white/5">
          {user && <Avatar user={{ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, avatarUrl: (user as any).avatarUrl ?? null }} size={32} />}
          <span className="min-w-0"><span className="block truncate text-[13px] font-semibold leading-tight">{user?.firstName} {user?.lastName}</span><span className="block truncate text-[11px] capitalize text-muted-foreground">{ws?.role?.toLowerCase() ?? "…"}</span></span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-full bg-[#f1f4f2] dark:bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#34d399]/20 blur-[110px] dark:bg-[#34d399]/8" />
        <div className="absolute -right-32 top-24 h-[420px] w-[420px] rounded-full bg-[#be185d]/12 blur-[120px] dark:bg-[#be185d]/8" />
        <div className="absolute -bottom-40 left-[35%] h-[420px] w-[420px] rounded-full bg-[#b08d57]/15 blur-[120px] dark:bg-[#b08d57]/8" />
      </div>

      <aside aria-label="EZ Sales menu" className="sticky top-0 z-30 hidden h-screen w-[268px] shrink-0 p-3 lg:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-y-0 left-0 w-[280px] p-2">{sidebar}</div>
        </div>
      )}

      <div className="relative z-10 min-w-0 flex-1">
        <header className="sticky top-0 z-20 px-4 pb-1 pt-4 sm:px-5">
          <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/60 px-3 py-2.5 shadow-[0_12px_40px_-24px_rgba(11,42,31,0.35)] backdrop-blur-2xl sm:px-4 dark:border-white/10 dark:bg-white/[0.04]">
            <button type="button" aria-label="Open menu" onClick={() => setMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border lg:hidden"><Menu className="h-4 w-4" /></button>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[11px] font-medium text-muted-foreground">EZ Sales</span>
              <h1 className="truncate text-[20px] font-semibold leading-tight tracking-tight">{title}</h1>
            </span>
            <span className="flex-1 sm:hidden" />
            <div className="hidden flex-1 justify-center sm:flex"><GlobalSearch ws={uid} /></div>
            <Notifications />
            {ws?.canEdit && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex h-10 items-center gap-1.5 rounded-xl bg-[#be185d] px-3.5 text-[13px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(190,24,93,0.9)] transition hover:brightness-110"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create</span></button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 rounded-xl p-1.5">
                  {([["contact", "Contact", Contact], ["company", "Company", Building2], ["deal", "Deal", CircleDollarSign], ["task", "Task", ListTodo]] as const).map(([k, l, I]) => (
                    <button key={k} type="button" onClick={() => setCreate(k)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium hover:bg-accent"><I className="h-4 w-4 text-muted-foreground" />{l}</button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="mt-2 sm:hidden"><GlobalSearch ws={uid} /></div>
        </header>
        <main className="px-4 pb-10 pt-3 sm:px-5">{children}</main>
      </div>
      {create && <CreateRecord kind={create} onClose={() => setCreate(null)} />}
    </div>
  );
}
