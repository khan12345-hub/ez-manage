"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, Bot, Building2, CheckCircle2, Crown, LayoutGrid, ListChecks, Search, Sparkles, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { BrandMark } from "@/app/layouts/AppShell/Sidebar/ProductNav";
import { ceoApi, useCeoAccess, type CeoCompany, type CeoHealth, type CeoOverview, type CeoSource } from "@/services/ceo-tower.api";
import { Avatar } from "../work/_components/primitives";

type View = "portfolio" | "tasks" | "team" | "boards" | "work" | "ai";
const VIEWS: { id: View; label: string; icon: typeof LayoutGrid; ready: boolean }[] = [
  { id: "portfolio", label: "Portfolio", icon: Building2, ready: true },
  { id: "tasks", label: "Tasks", icon: ListChecks, ready: false },
  { id: "team", label: "Team", icon: Users, ready: false },
  { id: "boards", label: "Boards", icon: LayoutGrid, ready: false },
  { id: "work", label: "Work", icon: CheckCircle2, ready: false },
  { id: "ai", label: "Executive AI", icon: Sparkles, ready: false },
];
const HEALTH: Record<CeoHealth, { label: string; cls: string; dot: string }> = {
  healthy: { label: "Healthy", cls: "bg-primary/10 text-primary ring-primary/20", dot: "bg-primary" },
  attention: { label: "Watch", cls: "bg-[#b08d57]/12 text-[#8a6a35] ring-[#b08d57]/30 dark:text-[#d9bd8c]", dot: "bg-[#b08d57]" },
  critical: { label: "Action needed", cls: "bg-destructive/10 text-destructive ring-destructive/25", dot: "bg-destructive" },
};
const companyHref = (c: { source: "boards" | "work"; uid: string }) => (c.source === "work" ? `/work/${c.uid}` : `/workspace/${c.uid}`);
const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const ago = (iso: string) => { const h = Math.round((Date.now() - +new Date(iso)) / 3_600_000); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

function SourceBadge({ source }: { source: "boards" | "work" }) {
  return <span className={cn("rounded px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-wide", source === "work" ? "bg-product-work/12 text-product-work" : "bg-product-boards/12 text-product-boards dark:text-[#a5b4fc]")}>{source}</span>;
}
function Bar({ value }: { value: number }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></span>;
}
function Panel({ icon: Icon, title, kicker, badge, children, footer }: { icon: typeof LayoutGrid; title: string; kicker: string; badge?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(11,42,31,0.04)]">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><Icon className="h-4.5 w-4.5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-serif text-[19px] leading-tight">{title}</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{kicker}</span></span>
        {badge}
      </header>
      <div className="min-h-0 flex-1 px-4 py-4">{children}</div>
      {footer && <footer className="border-t border-border px-5 py-3 text-[12.5px]">{footer}</footer>}
    </section>
  );
}

export default function CeoTowerPage() {
  const { user } = useAuth();
  const access = useCeoAccess();
  const [view, setView] = useState<View>("portfolio");
  const [source, setSource] = useState<CeoSource>("all");
  const [company, setCompany] = useState<CeoCompany | null>(null);
  const [q, setQ] = useState("");
  const [attention, setAttention] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ceo-tower", "overview", source, company?.key ?? null],
    queryFn: () => ceoApi.overview(source, company?.key),
    enabled: access.allowed,
    refetchInterval: 60_000,
  });
  // the company list stays complete while one company is in scope
  const { data: all } = useQuery({ queryKey: ["ceo-tower", "overview", source, null], queryFn: () => ceoApi.overview(source), enabled: access.allowed && !!company });
  const companies = (company ? all?.companies : data?.companies) ?? [];
  const shown = companies.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  if (!access.loading && !access.allowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <Crown className="h-8 w-8 text-[#b08d57]" />
        <h1 className="mt-3 font-serif text-[26px]">CEO Tower</h1>
        <p className="mt-1 max-w-[420px] text-[13.5px] text-muted-foreground">CEO Tower is for workspace owners. It shows every Boards and Work company you own in one place.</p>
        <Link href="/home" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  const attentionCount = (data?.attention.companies.length ?? 0) + (data?.attention.overdue.length ? 1 : 0);
  return (
    <div className="min-h-full bg-[#f6f8f6] dark:bg-background">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <Link href="/home" className="flex items-center gap-2.5" aria-label="EZ Manage home">
            <BrandMark size={34} />
            <span><span className="block font-serif text-[18px] leading-none">CEO Tower</span><span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">EZ Manage · Executive</span></span>
          </Link>
          <nav role="tablist" aria-label="CEO Tower views" className="ml-2 flex flex-wrap items-center gap-0.5 rounded-xl bg-muted/60 p-1 ring-1 ring-border/60">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" role="tab" aria-selected={view === v.id} disabled={!v.ready} title={v.ready ? undefined : "Being built — next steps"} onClick={() => setView(v.id)}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold", view === v.id ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:text-muted-foreground")}>
                <v.icon className="h-3.5 w-3.5" /> {v.label}{!v.ready && <span className="font-mono text-[8.5px] uppercase tracking-wide">soon</span>}
              </button>
            ))}
          </nav>
          <span className="flex-1" />
          <div role="group" aria-label="Product" className="flex rounded-lg border border-border p-0.5">
            {(["all", "boards", "work"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => { setSource(s); setCompany(null); }} className={cn("rounded-md px-2.5 py-1 text-[12px] font-medium", source === s ? "bg-forest text-forest-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{s === "all" ? "All companies" : s === "boards" ? "Boards" : "Work"}</button>
            ))}
          </div>
          <button type="button" onClick={() => setAttention(true)} disabled={!attentionCount} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1", attentionCount ? "bg-destructive/8 text-destructive ring-destructive/25 hover:bg-destructive/12" : "text-muted-foreground ring-border")}>
            <span className={cn("h-2 w-2 rounded-full", attentionCount ? "bg-destructive" : "bg-primary")} /> Attention needed ({attentionCount})
          </button>
          <span className="flex items-center gap-2 border-l border-border pl-3">
            {user && <Avatar user={{ id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: (user as any).avatarUrl ?? null, email: user.email } as any} size={30} />}
            <span className="hidden sm:block"><span className="block text-[13px] font-semibold leading-tight">{user?.firstName} {user?.lastName}</span><span className="block text-[11px] text-muted-foreground">Owner · {data ? `${data.owned.boards + data.owned.work} companies` : "…"}</span></span>
          </span>
        </div>
        {company && (
          <div className="flex items-center gap-2 border-t border-border bg-[#b08d57]/8 px-5 py-1.5 text-[12.5px]">
            Scope: <strong>{company.name}</strong> <SourceBadge source={company.source} />
            <button type="button" onClick={() => setCompany(null)} className="ml-1 flex items-center gap-1 font-medium text-primary hover:underline"><X className="h-3 w-3" /> Show all companies</button>
          </div>
        )}
      </header>

      {isError ? <p className="p-10 text-center text-[13px] text-muted-foreground">Couldn&apos;t load CEO Tower.</p> : !data || isLoading ? (
        <div className="grid gap-4 p-5 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[520px] animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="space-y-4 p-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8" role="list" aria-label="Key numbers">
            {([
              ["Companies", data.kpis.companies, `${data.owned.boards} Boards · ${data.owned.work} Work`, ""],
              ["People", data.kpis.people, "across your companies", ""],
              ["Open tasks", data.kpis.open, `${data.kpis.total} in total`, ""],
              ["In progress", data.kpis.inProgress, "being worked on", ""],
              ["Overdue", data.kpis.overdue, "past their due date", data.kpis.overdue ? "bad" : ""],
              ["Done · 7 days", data.kpis.doneWeek, "finished this week", "good"],
              ["Progress", `${data.kpis.progress}%`, `${data.kpis.done} done`, ""],
              ["Unassigned", data.kpis.unassigned, "open, nobody on it", data.kpis.unassigned ? "warn" : ""],
            ] as const).map(([label, value, sub, tone]) => (
              <div key={label} role="listitem" className={cn("rounded-xl border bg-card px-4 py-3", tone === "bad" ? "border-destructive/30" : tone === "warn" ? "border-[#b08d57]/40" : tone === "good" ? "border-primary/25" : "border-border")}>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className={cn("mt-1 font-serif text-[30px] leading-none", tone === "bad" && "text-destructive", tone === "good" && "text-primary", tone === "warn" && "text-[#8a6a35] dark:text-[#d9bd8c]")}>{value}</p>
                <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* companies */}
            <Panel icon={Building2} title="Companies & Portfolio" kicker="Every company you own" badge={<span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] ring-1 ring-border">{companies.length} active</span>}
              footer={<span className="flex items-center justify-between"><span>Scope: <strong>{company ? company.name : `All ${companies.length} companies`}</strong></span>{company && <button type="button" onClick={() => setCompany(null)} className="font-semibold text-primary hover:underline">Reset</button>}</span>}>
              <p className="mb-2 text-[12.5px] text-muted-foreground">Click a company to focus the whole tower on it.</p>
              <label className="mb-3 flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company by name" aria-label="Search companies" className="w-full bg-transparent text-[13px] outline-none" /></label>
              <ul aria-label="Companies" className="space-y-2.5">
                {shown.map((c) => {
                  const h = HEALTH[c.health];
                  const on = company?.key === c.key;
                  return (
                    <li key={c.key}>
                      <div className={cn("rounded-xl border p-3.5 transition-colors", on ? "border-primary/50 bg-primary/5" : c.health === "critical" ? "border-destructive/30 bg-destructive/[0.03]" : "border-border hover:border-primary/30")}>
                        <button type="button" onClick={() => setCompany(on ? null : c)} aria-pressed={on} className="block w-full text-left">
                          <span className="flex items-center gap-2"><span className={cn("h-2 w-2 shrink-0 rounded-full", h.dot)} /><span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.name}</span><SourceBadge source={c.source} /><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", h.cls)}>{h.label}</span></span>
                          <span className="mt-2 grid grid-cols-4 gap-1 text-[11.5px]">
                            <span>Open <strong className="block text-[14px]">{c.stats.open}</strong></span>
                            <span>Overdue <strong className={cn("block text-[14px]", c.stats.overdue && "text-destructive")}>{c.stats.overdue}</strong></span>
                            <span>Working <strong className="block text-[14px]">{c.stats.inProgress}</strong></span>
                            <span>People <strong className="block text-[14px]">{c.people}</strong></span>
                          </span>
                          <span className="mt-2 flex items-center gap-2"><span className="flex-1"><Bar value={c.stats.progress} /></span><span className="font-mono text-[11px] text-muted-foreground">{c.stats.progress}%</span></span>
                        </button>
                        <Link href={companyHref(c)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">Open in {c.source === "work" ? "Work" : "Boards"} <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </li>
                  );
                })}
                {!shown.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">No company matches.</li>}
              </ul>
            </Panel>

            {/* people */}
            <Panel icon={Users} title="Management & Teams" kicker="Who carries the work" badge={<span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] ring-1 ring-border">{data.kpis.people} people</span>}
              footer={<span className="flex items-center justify-between"><span>Total open: <strong className="text-destructive">{data.kpis.open} tasks</strong></span><span className="text-muted-foreground">Full Team view · next step</span></span>}>
              <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[11.5px] font-semibold">
                <span className="flex items-center gap-1.5 text-destructive"><span className="h-2 w-2 rounded-full bg-destructive" />Overdue</span>
                <span className="flex items-center gap-1.5 text-[#8a6a35] dark:text-[#d9bd8c]"><span className="h-2 w-2 rounded-full bg-[#b08d57]" />Working on</span>
                <span className="flex items-center gap-1.5 text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Done · 7d</span>
              </div>
              <ul aria-label="People" className="space-y-2">
                {data.people.map((p) => (
                  <li key={p.user.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={p.user as any} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{p.user.firstName} {p.user.lastName}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.stats.open} open · {p.companies.length ? p.companies.map((c) => `${c.name} (${c.source})`).join(", ") : "no tasks assigned"}</span>
                      </span>
                      <span className="flex gap-1 font-mono text-[11.5px] font-semibold">
                        <span title="Overdue" className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-destructive">{p.stats.overdue}</span>
                        <span title="Working on" className="rounded-md bg-[#b08d57]/15 px-1.5 py-0.5 text-[#8a6a35] dark:text-[#d9bd8c]">{p.stats.inProgress}</span>
                        <span title="Done in 7 days" className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{p.stats.doneWeek}</span>
                      </span>
                    </div>
                    <span className="mt-2 flex items-center gap-2"><span className="flex-1"><Bar value={p.stats.progress} /></span><span className="font-mono text-[10.5px] text-muted-foreground">{p.stats.progress}%</span></span>
                  </li>
                ))}
                {!data.people.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">No people yet.</li>}
              </ul>
            </Panel>

            {/* updates + AI */}
            <div className="flex flex-col gap-4">
              <Panel icon={BarChart3} title="Master Updates" kicker="What moved this week" badge={<span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] text-primary ring-1 ring-primary/25">Live</span>}>
                <h3 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Finished · last 7 days</h3>
                <ul aria-label="Recent updates" className="space-y-1.5">
                  {data.updates.slice(0, 6).map((u) => (
                    <li key={`${u.source}-${u.task.id}`} className="flex items-start gap-2 text-[12.5px]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="font-semibold">{u.people.join(", ") || "Someone"}</strong> finished <span className="font-medium">{u.task.name}</span> <span className="text-muted-foreground">· {u.company} / {u.where}</span></span><span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{ago(u.at)}</span></li>
                  ))}
                  {!data.updates.length && <li className="text-[12.5px] text-muted-foreground">Nothing finished in the last 7 days.</li>}
                </ul>
                <h3 className="mb-1.5 mt-4 text-[12px] font-semibold text-muted-foreground">Most overdue</h3>
                <ul aria-label="Most overdue" className="space-y-1.5">
                  {data.attention.overdue.slice(0, 5).map((o) => (
                    <li key={`${o.source}-${o.task.id}`} className="flex items-start gap-2 text-[12.5px]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><span className="min-w-0 flex-1"><span className="font-medium">{o.task.name}</span> <span className="text-muted-foreground">· {o.people.join(", ") || "unassigned"} · {o.company}</span></span><span className="shrink-0 font-mono text-[10.5px] font-semibold text-destructive">{fmtDate(o.due)}</span></li>
                  ))}
                  {!data.attention.overdue.length && <li className="text-[12.5px] text-muted-foreground">Nothing overdue. 👏</li>}
                </ul>
              </Panel>
              <Panel icon={Bot} title="Ask Executive AI" kicker="Coming in step 5 · Claude" badge={<span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border">Soon</span>}>
                <div className="flex flex-wrap gap-1.5">
                  {["Khan kia kar raha hai?", "Kaun se tasks in progress hain?", "Kis ki team peeche hai?", "Overdue > 48h"].map((c) => <span key={c} className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground">{c}</span>)}
                </div>
                <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[12.5px] text-muted-foreground">Ask anything about your companies in plain words: who is doing what, progress of a person, team, folder or list, what is stuck. It reads live data only and never changes anything.</p>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {attention && data && <AttentionDialog data={data} onClose={() => setAttention(false)} onPick={(key) => { const c = companies.find((x) => x.key === key); if (c) setCompany(c); setAttention(false); }} />}
    </div>
  );
}

function AttentionDialog({ data, onClose, onPick }: { data: CeoOverview; onClose: () => void; onPick: (key: string) => void }) {
  const [tab, setTab] = useState<"companies" | "overdue">(data.attention.companies.length ? "companies" : "overdue");
  const overdue = useMemo(() => data.attention.overdue, [data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Attention needed</DialogTitle>
        <DialogDescription>Companies at risk and the tasks that slipped past their due date.</DialogDescription>
        <div role="tablist" aria-label="Attention" className="flex gap-1">
          {([["companies", `Companies (${data.attention.companies.length})`], ["overdue", `Overdue tasks (${overdue.length})`]] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium", tab === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
        </div>
        <ul className="max-h-[52vh] space-y-1.5 overflow-y-auto">
          {tab === "companies" ? data.attention.companies.map((c) => (
            <li key={c.key}><button type="button" onClick={() => onPick(c.key)} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-accent/50"><span className="flex-1 font-medium">{c.name}</span><SourceBadge source={c.source} /><span className="font-mono text-[12px] text-destructive">{c.overdue} overdue</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></button></li>
          )) : overdue.map((o) => (
            <li key={`${o.source}-${o.task.id}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]"><span className="min-w-0 flex-1"><span className="block truncate font-medium">{o.task.name}</span><span className="block truncate text-[11.5px] text-muted-foreground">{o.company} / {o.where} · {o.people.join(", ") || "unassigned"}</span></span><SourceBadge source={o.source} /><span className="font-mono text-[12px] font-semibold text-destructive">{fmtDate(o.due)}</span></li>
          ))}
          {tab === "companies" && !data.attention.companies.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">Every company is healthy.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
