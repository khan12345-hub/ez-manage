"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { AlertTriangle, ArrowRight, AtSign, CalendarClock, CalendarDays, Mail, BarChart3, Bot, Building2, CheckCircle2, Crown, LayoutDashboard, FileDown, Inbox, KeyRound, LayoutGrid, Settings2, ThumbsDown, ListChecks, MessageSquare, MessagesSquare, MessageSquareReply, Search, Sparkles, UserPlus, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, useCeoAccess, type CeoPerson, type CeoCompany, type CeoForYouItem, type CeoForYouKind, type CeoHealth, type CeoOverview, type CeoSource } from "@/services/ceo-tower.api";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../work/_components/primitives";
import { TasksView } from "./_components/TasksView";
import { TeamView } from "./_components/TeamView";
import { MeetingsView } from "./_components/MeetingsView";
import { EmailView } from "./_components/EmailView";
import { ProductView } from "./_components/ProductView";
import { aiPrompts, AiView } from "./_components/AiView";
import { CompanyPanel, type PanelTab } from "./_components/CompanyPanel";
import { MessageDialog } from "./_components/MessageDialog";
import { AssignTaskDialog } from "./_components/AssignTaskDialog";
import { SourceBadge, fmtDate } from "./_components/bits";
import { ShareAccessDialog } from "./_components/ShareAccessDialog";
import { ManagePeopleDialog } from "./_components/ManagePeopleDialog";
import { ManagementList } from "./_components/ManagementList";
import { TrendsCard } from "./_components/TrendsCard";
import { SettingsDialog } from "./_components/SettingsDialog";
import { TaskPopup, useTaskPopup } from "./_components/TaskPopup";
import { BriefCard } from "./_components/BriefCard";
import { CeoDashboard } from "./_components/CeoDashboard";
import { ProfileView } from "./_components/ProfileView";
import { AppSwitcher } from "@/components/AppSwitcher";
import { CalendarView } from "./_components/CalendarView";
import { ChannelsView } from "./_components/ChannelsView";
import { PRODUCT_NAME } from "@/lib/products";

type View = "dashboard" | "channels" | "portfolio" | "management" | "tasks" | "team" | "boards" | "work" | "calendar" | "meetings" | "email" | "ai" | "profile";
const VIEWS: { id: View; label: string; icon: typeof LayoutGrid; ready: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { id: "channels", label: "Channels", icon: MessagesSquare, ready: true },
  { id: "portfolio", label: "Companies", icon: Building2, ready: true },
  { id: "management", label: "Management & Teams", icon: Crown, ready: true },
  { id: "tasks", label: "Tasks", icon: ListChecks, ready: true },
  { id: "team", label: "Team", icon: Users, ready: true },
  { id: "boards", label: PRODUCT_NAME.boards, icon: LayoutGrid, ready: true },
  { id: "work", label: PRODUCT_NAME.work, icon: CheckCircle2, ready: true },
  { id: "calendar", label: "Calendar", icon: CalendarDays, ready: true },
  { id: "meetings", label: "Meetings", icon: CalendarClock, ready: true },
  { id: "email", label: "Email", icon: Mail, ready: true },
  { id: "ai", label: "Executive AI", icon: Sparkles, ready: true },
  { id: "profile", label: "My profile", icon: UserRound, ready: true },
];
const HEALTH: Record<CeoHealth, { label: string; cls: string; dot: string }> = {
  healthy: { label: "Healthy", cls: "bg-primary/10 text-primary ring-primary/20", dot: "bg-primary" },
  attention: { label: "Watch", cls: "bg-[#b08d57]/12 text-[#8a6a35] ring-[#b08d57]/30 dark:text-[#d9bd8c]", dot: "bg-[#b08d57]" },
  critical: { label: "Action needed", cls: "bg-destructive/10 text-destructive ring-destructive/25", dot: "bg-destructive" },
};
const companyHref = (c: { source: "boards" | "work"; uid: string }) => (c.source === "work" ? `/work/${c.uid}` : `/workspace/${c.uid}`);
const ago = (iso: string) => { const h = Math.round((Date.now() - +new Date(iso)) / 3_600_000); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

function Bar({ value }: { value: number }) {
  return <span className="block h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></span>;
}
function Panel({ icon: Icon, title, kicker, badge, children, footer }: { icon: typeof LayoutGrid; title: string; kicker: string; badge?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col rounded-[24px] border border-white/70 bg-white/65 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <header className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/10">
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
  const [view, setViewState] = useState<View>("dashboard");
  const [chTab, setChTab] = useState<"chat" | "assigned">("chat");
  // the open view lives in the URL (?view=…) so a reload or a shared link lands on the same page
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view") as View | null;
    if (v && VIEWS.some((x) => x.id === v)) setViewState(v);
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    const u = new URL(window.location.href);
    if (v === "dashboard") u.searchParams.delete("view"); else u.searchParams.set("view", v);
    window.history.replaceState(null, "", u.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [source, setSource] = useState<CeoSource>("all");
  const [company, setCompany] = useState<CeoCompany | null>(null);
  // Work picked → no Accounts & Invoices page (and the other way round)
  const shownViews = VIEWS.filter((v) => !((v.id === "boards" && source === "work") || (v.id === "work" && source === "boards")));
  useEffect(() => { if (!shownViews.some((v) => v.id === view)) setView("dashboard"); }, [source]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState("");
  const [attention, setAttention] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tasksMine, setTasksMine] = useState(false);
  const [managing, setManaging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showTask = useTaskPopup((s) => s.show);
  const [aiAsk, setAiAsk] = useState<string | null>(null);
  const [aiText, setAiText] = useState("");
  const askAi = (q: string) => { if (!q.trim()) return; setAiAsk(q.trim()); setAiText(""); setView("ai"); };
  const [panel, setPanel] = useState<{ company: CeoCompany; start: PanelTab } | null>(null);
  const [messageTo, setMessageTo] = useState<CeoOverview["people"][number]["user"] | null>(null);
  const [assignTo, setAssignTo] = useState<number | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ceo-tower", "overview", source, company?.key ?? null],
    queryFn: () => ceoApi.overview(source, company?.key),
    enabled: access.allowed,
    refetchInterval: 60_000,
  });
  // the company list stays complete while one company is in scope
  const { data: all } = useQuery({ queryKey: ["ceo-tower", "overview", source, null], queryFn: () => ceoApi.overview(source), enabled: access.allowed && !!company });
  const { data: forYou } = useQuery({ queryKey: ["ceo-tower", "for-you"], queryFn: ceoApi.forYou, enabled: access.allowed, refetchInterval: 60_000 });
  const companies = (company ? all?.companies : data?.companies) ?? [];
  const shown = companies.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));

  if (!access.loading && !access.allowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <Crown className="h-8 w-8 text-[#b08d57]" />
        <h1 className="mt-3 font-serif text-[26px]">Executive Hub</h1>
        <p className="mt-1 max-w-[420px] text-[13.5px] text-muted-foreground">Executive Hub is only for Administrators. Ask an Administrator if you need it.</p>
        <Link href="/home" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  const forYouCount = forYou?.count ?? 0;
  const attentionCount = forYouCount + (data?.attention.companies.length ?? 0) + (data?.attention.overdue.length ? 1 : 0);
  return (
    <div className="relative flex min-h-full bg-[#eef3f0] dark:bg-background">
      {/* soft colour behind the glass */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-[#34d399]/25 blur-[110px] dark:bg-[#34d399]/10" />
        <div className="absolute -bottom-40 left-[30%] h-[460px] w-[460px] rounded-full bg-[#b08d57]/20 blur-[120px] dark:bg-[#b08d57]/10" />
        <div className="absolute -right-24 top-20 h-[380px] w-[380px] rounded-full bg-[#0b2a1f]/10 blur-[100px]" />
      </div>

      {/* glass sidebar */}
      <aside aria-label="Executive Hub menu" className="sticky top-0 z-30 hidden h-screen w-[296px] shrink-0 p-3 lg:block">
        <div className="flex h-full flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-white/60 p-3.5 shadow-[0_20px_60px_-24px_rgba(11,42,31,0.35)] ring-1 ring-black/[0.03] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.04]">
          {/* switch app (same place in every product) */}
          <AppSwitcher active="ceo" subtitle="EZ Manage · Executive" />

          {/* companies: which product, then one company or all */}
          <p className="mb-1.5 mt-5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Companies</p>
          <div role="group" aria-label="Product" className="grid grid-cols-3 gap-1 rounded-2xl bg-white/60 p-1 ring-1 ring-black/[0.04] dark:bg-white/5">
            {(["all", "boards", "work"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={source === s} onClick={() => { setSource(s); setCompany(null); }} className={cn("rounded-xl py-1.5 text-[12px] font-semibold transition", source === s ? "bg-white text-foreground shadow-sm dark:bg-white/15" : "text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : s === "boards" ? "Accounts" : "Work"}</button>
            ))}
          </div>
          <label className="mt-2 flex h-10 items-center gap-2 rounded-2xl bg-white/60 px-3 ring-1 ring-black/[0.04] dark:bg-white/5">
            <Building2 className="h-4 w-4 shrink-0 text-[#b08d57]" />
            <select aria-label="Focus on one company" value={company?.key ?? ""} onChange={(e) => setCompany(companies.find((c) => c.key === e.target.value) ?? null)} className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-[13px] font-medium outline-none">
              <option value="">All companies ({companies.length})</option>
              {companies.map((c) => <option key={c.key} value={c.key}>{c.name} · {c.source === "work" ? "Work" : "Accounts"}</option>)}
            </select>
          </label>

          <button type="button" onClick={() => setAttention(true)} disabled={!attentionCount} className={cn("mt-4 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[13px] font-semibold transition", attentionCount ? "bg-gradient-to-br from-[#fee2e2] to-[#fecaca]/70 text-[#b91c1c] shadow-[0_8px_20px_-12px_rgba(185,28,28,0.6)] hover:brightness-[1.02] dark:from-destructive/20 dark:to-destructive/10 dark:text-[#fca5a5]" : "bg-white/50 text-muted-foreground dark:bg-white/5")}>
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", attentionCount ? "bg-white/70 dark:bg-white/10" : "bg-white/60")}><AlertTriangle className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block">Attention needed</span>{(forYouCount > 0 || (forYou?.approvals ?? 0) > 0) && <span className="block text-[11px] font-medium opacity-80">{forYouCount > 0 && `${forYouCount} for you`}{forYouCount > 0 && (forYou?.approvals ?? 0) > 0 && " · "}{(forYou?.approvals ?? 0) > 0 && `${forYou!.approvals} to approve`}</span>}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-[12px] dark:bg-white/10">{attentionCount}</span>
          </button>

          <p className="mb-1.5 mt-5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Views</p>
          <nav role="tablist" aria-label="Executive Hub views" className="space-y-0.5">
            {shownViews.map((v) => (
              <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}
                className={cn("group flex w-full items-center gap-3 rounded-2xl px-2.5 py-[7px] text-left text-[13.5px] font-medium transition-all",
                  view === v.id ? "bg-forest text-white shadow-[0_10px_24px_-12px_rgba(11,42,31,0.8)] dark:bg-primary dark:text-primary-foreground" : "text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5")}>
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition", view === v.id ? "bg-white/10 text-brass-soft" : "bg-white/60 text-muted-foreground group-hover:text-foreground dark:bg-white/5")}><v.icon className="h-4 w-4" /></span>
                <span className="min-w-0 truncate">{v.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-0.5 pt-5">
            <Link href="/ceo/report" className="flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-medium text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5"><FileDown className="h-4 w-4 text-[#b08d57]" /> Executive report</Link>
            <button type="button" onClick={() => setSettingsOpen(true)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[13px] font-medium text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5"><Settings2 className="h-4 w-4 text-[#b08d57]" /> Brief &amp; alerts</button>
            {access.canShare && <button type="button" onClick={() => setSharing(true)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-[13px] font-medium text-foreground/75 hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5"><KeyRound className="h-4 w-4 text-[#b08d57]" /> Share access</button>}
            <button type="button" onClick={() => setView("profile")} aria-label="My profile" title="My profile" className={cn("mt-2 flex w-full items-center gap-2.5 rounded-2xl bg-white/60 p-2.5 text-left ring-1 ring-black/[0.04] transition hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10", view === "profile" && "ring-2 ring-[#b08d57]/50")}>
              {user && <Avatar user={{ id: user.id, firstName: user.firstName, lastName: user.lastName, avatarUrl: (user as any).avatarUrl ?? null, email: user.email } as any} size={34} />}
              <span className="min-w-0"><span className="block truncate text-[13px] font-semibold leading-tight">{user?.firstName} {user?.lastName}</span><span className="block truncate text-[11px] text-muted-foreground">{access.canShare ? "Owner" : "Shared"} · {data ? `${data.owned.boards + data.owned.work} companies` : "…"}</span></span>
            </button>
          </div>
        </div>
      </aside>

      <div className="relative z-10 min-w-0 flex-1">
      {/* top bar: title + scope (and the menu on small screens) */}
      <header className="z-20 px-5 pb-1 pt-5 sm:sticky sm:top-0">
        <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-white/70 bg-white/55 px-4 py-3 shadow-[0_12px_40px_-24px_rgba(11,42,31,0.35)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]">
          <div className="w-full lg:hidden"><AppSwitcher active="ceo" subtitle="EZ Manage · Executive" /></div>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">Executive Hub</span>
            <h1 className="font-serif text-[22px] leading-tight">{VIEWS.find((v) => v.id === view)?.label}</h1>
          </span>
          {company && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#b08d57]/12 px-3 py-1 text-[12.5px]">
              <strong>{company.name}</strong> <SourceBadge source={company.source} />
              <button type="button" aria-label="Show all companies" onClick={() => setCompany(null)} className="ml-0.5 rounded-full p-0.5 hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
            </span>
          )}
          <span className="flex-1" />
          <span className="hidden text-[12.5px] text-muted-foreground sm:block">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
          {/* small screens: the menu as chips */}
          <div className="flex w-full gap-1 overflow-x-auto lg:hidden">
            <button type="button" onClick={() => setAttention(true)} className="shrink-0 rounded-full bg-destructive/10 px-3 py-1 text-[12px] font-semibold text-destructive">Attention {attentionCount}</button>
            {shownViews.map((v) => <button key={v.id} type="button" onClick={() => setView(v.id)} className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold", view === v.id ? "bg-forest text-white dark:bg-primary" : "bg-white/70 text-muted-foreground dark:bg-white/5")}>{v.label}</button>)}
            {(["all", "boards", "work"] as const).map((s) => <button key={s} type="button" onClick={() => { setSource(s); setCompany(null); }} className={cn("shrink-0 rounded-full px-3 py-1 text-[12px]", source === s ? "bg-white font-semibold shadow-sm dark:bg-white/15" : "text-muted-foreground")}>{s === "all" ? "All" : s === "boards" ? "Accounts" : "Work"}</button>)}
          </div>
        </div>
      </header>
      {!access.canShare && access.sharedBy.length > 0 && (
        <p className="border-b border-border bg-[#b08d57]/8 px-5 py-1.5 text-[12px] text-muted-foreground">
          <KeyRound className="mr-1 inline h-3 w-3 text-[#b08d57]" /> {access.sharedBy.map((o) => o.name).join(", ")} shared Executive Hub with you — you see their companies.
        </p>
      )}
      {sharing && <ShareAccessDialog onClose={() => setSharing(false)} />}
      <TaskPopup />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {managing && <ManagePeopleDialog companies={companies} defaultKey={company?.key ?? null} onClose={() => setManaging(false)} />}

      {isError ? <p className="p-10 text-center text-[13px] text-muted-foreground">Couldn&apos;t load Executive Hub.</p> : !data || isLoading ? (
        <div className="grid gap-4 p-5 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[520px] animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (
        <div className="space-y-4 p-5">
          {/* KPIs (the Dashboard has its own animated ones) */}
          {view === "portfolio" && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8" role="list" aria-label="Key numbers">
            {([
              ["Companies", data.kpis.companies, `${data.owned.boards} Accounts · ${data.owned.work} Work`, ""],
              ["People", data.kpis.people, "across your companies", ""],
              ["Open tasks", data.kpis.open, `${data.kpis.total} in total`, ""],
              ["In progress", data.kpis.inProgress, "being worked on", ""],
              ["Overdue", data.kpis.overdue, "past their due date", data.kpis.overdue ? "bad" : ""],
              ["Done · 7 days", data.kpis.doneWeek, "finished this week", "good"],
              ["Progress", `${data.kpis.progress}%`, `${data.kpis.done} done`, ""],
              ["Unassigned", data.kpis.unassigned, "open, nobody on it", data.kpis.unassigned ? "warn" : ""],
            ] as const).map(([label, value, sub, tone]) => (
              <div key={label} role="listitem" className={cn("rounded-[20px] border bg-white/65 px-4 py-3 shadow-[0_12px_32px_-24px_rgba(11,42,31,0.45)] backdrop-blur-xl dark:bg-white/[0.04]", tone === "bad" ? "border-destructive/30" : tone === "warn" ? "border-[#b08d57]/40" : tone === "good" ? "border-primary/25" : "border-white/70 dark:border-white/10")}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                <p className={cn("mt-1 font-serif text-[30px] leading-none", tone === "bad" && "text-destructive", tone === "good" && "text-primary", tone === "warn" && "text-[#8a6a35] dark:text-[#d9bd8c]")}>{value}</p>
                <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>}

          {view === "dashboard" ? <CeoDashboard data={data} source={source} company={company?.key ?? null} onFocus={(c) => setCompany(company?.key === c.key ? null : c)} onOpen={(c) => setPanel({ company: c, start: { tab: "tasks", state: "open" } })} onView={(v) => setView(v)} onAssigned={() => { setChTab("assigned"); setView("channels"); }} />
            : view === "channels" ? <ChannelsView companies={companies} tab={chTab} onTab={setChTab} source={source} scope={company?.key ?? null} />
            : view === "profile" ? <ProfileView data={data} onView={(v) => setView(v)} onBrief={() => setSettingsOpen(true)} />
            : view === "ai" ? <AiView initialAsk={aiAsk} onAsked={() => setAiAsk(null)} />
            : view === "calendar" ? <CalendarView />
            : view === "meetings" ? <MeetingsView />
            : view === "email" ? <EmailView />
            : view === "team" ? <TeamView source={source} company={company?.key ?? null} companies={companies} />
            : view === "boards" || view === "work" ? <ProductView product={view} company={company?.source === view ? company.key : null} companies={companies} />
            : view === "tasks" ? <TasksView key={tasksMine ? "mine" : "all"} source={source} company={company?.key ?? null} overview={data} initialMine={tasksMine} /> :
          view === "management" ? (
          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
            <Panel icon={Users} title="Management & Teams" kicker="Managers and their teams" badge={<span className="flex items-center gap-1.5"><span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] ring-1 ring-border">{data.kpis.people} people</span><button type="button" onClick={() => setManaging(true)} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-primary/25 hover:bg-primary/5">Manage</button></span>}
              footer={<span className="flex flex-wrap items-center justify-between gap-2"><span>Your open tasks: <strong className="text-destructive">{data.ceoTasks?.open ?? 0}</strong>{data.ceoTasks?.overdue ? <span className="text-destructive"> · {data.ceoTasks.overdue} overdue</span> : null}</span><span className="flex gap-3"><button type="button" onClick={() => { setTasksMine(true); setView("tasks"); }} className="font-semibold text-primary hover:underline">View CEO tasks →</button><button type="button" onClick={() => { setTasksMine(false); setView("tasks"); }} className="font-semibold text-muted-foreground hover:text-foreground hover:underline">All tasks</button></span></span>}>
              <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[11.5px] font-semibold">
                <span className="flex items-center gap-1.5 text-destructive"><span className="h-2 w-2 rounded-full bg-destructive" />Overdue</span>
                <span className="flex items-center gap-1.5 text-[#8a6a35] dark:text-[#d9bd8c]"><span className="h-2 w-2 rounded-full bg-[#b08d57]" />Working on</span>
                <span className="flex items-center gap-1.5 text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Done · 7d</span>
              </div>
              <ManagementList source={source} company={company?.key ?? null} meId={user?.id} onMessage={(p) => setMessageTo(p)} onAssign={(id) => setAssignTo(id)} />
            </Panel>
            <div className="flex flex-col gap-4">
              <Panel icon={BarChart3} title="Master Updates" kicker="What moved this week" badge={<span className="rounded-full px-2.5 py-0.5 font-mono text-[11px] text-primary ring-1 ring-primary/25">Live</span>}>
                <BriefCard />
                <h3 className="mb-1.5 mt-4 text-[12px] font-semibold text-muted-foreground">Finished · last 7 days</h3>
                <ul aria-label="Recent updates" className="space-y-1.5">
                  {data.updates.slice(0, 8).map((u) => (
                    <li key={`${u.source}-${u.task.id}`} className="flex items-start gap-2 text-[12.5px]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><strong className="font-semibold">{u.people.join(", ") || "Someone"}</strong> finished <button type="button" onClick={() => showTask(u.source, u.task.id)} className="text-left font-medium hover:text-primary hover:underline">{u.task.name}</button> <span className="text-muted-foreground">· {u.company} / {u.where}</span></span><span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{ago(u.at)}</span></li>
                  ))}
                  {!data.updates.length && <li className="text-[12.5px] text-muted-foreground">Nothing finished in the last 7 days.</li>}
                </ul>
              </Panel>
              <Panel icon={Bot} title="Ask Executive AI" kicker="Live data · acts only after you confirm">
                <div className="flex flex-wrap gap-1.5">
                  {aiPrompts(data, user?.id).slice(0, 4).map((c) => <button key={c} type="button" onClick={() => askAi(c)} className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground">{c}</button>)}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={aiText} onChange={(e) => setAiText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && askAi(aiText)} placeholder="Ask AI: e.g. Who is falling behind today?" aria-label="Ask AI" className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-primary/50" />
                  <button type="button" aria-label="Ask AI" onClick={() => askAi(aiText)} disabled={!aiText.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><ArrowRight className="h-4 w-4" /></button>
                </div>
              </Panel>
            </div>
          </div>
          ) : (
          <>
          <section aria-label="Companies" className="rounded-[24px] border border-white/70 bg-white/55 p-4 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <header className="mb-4 flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><Building2 className="h-4.5 w-4.5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[17px] font-semibold leading-tight">{access.canShare ? "Every company you own" : "Every company shared with you"}</span><span className="block text-[12px] text-muted-foreground">Click a company to focus the whole tower on it · {company ? <>Scope: <strong>{company.name}</strong> <button type="button" onClick={() => setCompany(null)} className="font-semibold text-primary hover:underline">Reset</button></> : `${companies.length} active`}</span></span>
              <label className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-background px-3 sm:w-[280px]"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company by name" aria-label="Search companies" className="w-full bg-transparent text-[13px] outline-none" /></label>
            </header>
            <ul aria-label="Companies" className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {shown.map((c) => {
                  const h = HEALTH[c.health];
                  const on = company?.key === c.key;
                  return (
                    <li key={c.key}>
                      <div className={cn("h-full rounded-[20px] border bg-white/70 p-4 shadow-[0_12px_32px_-26px_rgba(11,42,31,0.5)] backdrop-blur-xl transition-all hover:-translate-y-0.5 dark:bg-white/[0.04]", on ? "border-primary/50 bg-primary/5" : c.health === "critical" ? "border-destructive/30 bg-destructive/[0.03]" : "border-border hover:border-primary/30")}>
                        <button type="button" onClick={() => setCompany(on ? null : c)} aria-pressed={on} className="block w-full text-left">
                          <span className="flex items-center gap-2"><span className={cn("h-2 w-2 shrink-0 rounded-full", h.dot)} /><span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.name}</span><SourceBadge source={c.source} /><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", h.cls)}>{h.label}</span></span>
                          <span className="mt-0.5 block truncate pl-4 text-[11.5px] text-muted-foreground">Lead: <span className="font-medium text-foreground/80">{c.leads?.length ? c.leads.join(" / ") : "you"}</span></span>
                        </button>
                        <span className="mt-2 grid grid-cols-4 gap-1 text-[11.5px]">
                          {([["Open", c.stats.open, { tab: "tasks", state: "open" }, ""], ["Overdue", c.stats.overdue, { tab: "tasks", state: "overdue" }, c.stats.overdue ? "text-destructive" : ""], ["Working", c.stats.inProgress, { tab: "tasks", state: "in_progress" }, ""], ["People", c.people, { tab: "people" }, ""]] as const).map(([label, n, start, cls]) => (
                            <button key={label} type="button" aria-label={`${c.name}: ${n} ${label.toLowerCase()} — show`} onClick={() => setPanel({ company: c, start: start as PanelTab })} className="rounded-md px-1 py-0.5 text-left hover:bg-accent">
                              {label} <strong className={cn("block text-[14px] underline-offset-2 hover:underline", cls)}>{n}</strong>
                            </button>
                          ))}
                        </span>
                        <span className="mt-2 flex items-center gap-2"><span className="flex-1"><Bar value={c.stats.progress} /></span><span className="font-mono text-[11px] text-muted-foreground">{c.stats.progress}%</span></span>
                        <Link href={companyHref(c)} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">Open in {c.source === "work" ? PRODUCT_NAME.work : PRODUCT_NAME.boards} <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </li>
                  );
                })}
                {!shown.length && <li className="col-span-full py-6 text-center text-[12.5px] text-muted-foreground">No company matches.</li>}
              </ul>
          </section>
          <div className="mt-4"><TrendsCard source={source} company={company?.key ?? null} /></div>
          </>
          )}
        </div>
      )}

      {panel && <CompanyPanel company={panel.company} start={panel.start} workCompanies={companies.filter((c) => c.source === "work")} onClose={() => setPanel(null)} />}
      {messageTo && <MessageDialog person={messageTo} onClose={() => setMessageTo(null)} />}
      {assignTo && <AssignTaskDialog companies={companies} people={[]} defaultCompany={company?.key ?? null} defaultAssignee={assignTo} onClose={() => setAssignTo(null)} />}
      {attention && data && <AttentionDialog data={data} forYou={forYou?.items ?? []} onClose={() => setAttention(false)} onPick={(key) => { const c = companies.find((x) => x.key === key); if (c) setCompany(c); setAttention(false); }} />}
      </div>
    </div>
  );
}

const KIND: Record<CeoForYouKind, { label: string; icon: typeof Inbox }> = {
  assigned: { label: "Assigned to you", icon: UserPlus },
  mention: { label: "Mentioned you", icon: AtSign },
  reply: { label: "Replied to you", icon: MessageSquareReply },
  comment: { label: "Commented", icon: MessageSquare },
  message: { label: "Message", icon: MessageSquare },
  completed: { label: "Completed", icon: CheckCircle2 },
};

function AttentionDialog({ data, forYou, onClose, onPick }: { data: CeoOverview; forYou: CeoForYouItem[]; onClose: () => void; onPick: (key: string) => void }) {
  const showTask = useTaskPopup((s) => s.show);
  const [replyTo, setReplyTo] = useState<CeoPerson | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const approvals = forYou.filter((i) => i.approval && i.task);
  const [tab, setTab] = useState<"approvals" | "foryou" | "companies" | "overdue">(approvals.length ? "approvals" : forYou.length ? "foryou" : data.attention.companies.length ? "companies" : "overdue");
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const read = useMutation({ mutationFn: (i: CeoForYouItem) => ceoApi.markForYouRead(i.source, i.id), onSettled: () => qc.invalidateQueries({ queryKey: ["ceo-tower", "for-you"] }) });
  // One-click approve: "Approved" in the task's thread as you (the asker is notified), and the item is done
  const decline = useMutation({
    mutationFn: async ({ i, why }: { i: CeoForYouItem; why: string }) => { await ceoApi.taskComment(i.task!.source, i.task!.id, `❌ Not approved.${why.trim() ? ` ${why.trim()}` : ""}`); await ceoApi.markForYouRead(i.source, i.id); },
    onSuccess: () => { toast.success("Declined — they've been told why in the task"); setDeclining(null); setReason(""); qc.invalidateQueries({ queryKey: ["ceo-tower", "for-you"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't decline."),
  });
  const approve = useMutation({
    mutationFn: async (i: CeoForYouItem) => { await ceoApi.taskComment(i.task!.source, i.task!.id, "✅ Approved."); await ceoApi.markForYouRead(i.source, i.id); },
    onSuccess: () => { toast.success("Approved — they've been told in the task"); qc.invalidateQueries({ queryKey: ["ceo-tower", "for-you"] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't approve."),
  });
  const open = (i: CeoForYouItem) => { read.mutate(i); if (i.href) router.push(i.href); else onClose(); };
  const overdue = useMemo(() => data.attention.overdue, [data]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Attention needed</DialogTitle>
        <DialogDescription>What people need from you, companies at risk, and tasks that slipped past their due date.</DialogDescription>
        <div role="tablist" aria-label="Attention" className="flex gap-1">
          {([["approvals", `Approvals (${approvals.length})`], ["foryou", `For you (${forYou.length})`], ["companies", `Companies (${data.attention.companies.length})`], ["overdue", `Overdue tasks (${overdue.length})`]] as const).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium", tab === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
        </div>
        <ul className="max-h-[52vh] space-y-1.5 overflow-y-auto">
          {tab === "approvals" && approvals.map((i) => (
            <li key={`a-${i.source}-${i.id}`} className="rounded-lg border border-[#b08d57]/40 bg-[#b08d57]/[0.05] p-3">
              <p className="flex items-center gap-2 text-[13px]"><strong className="truncate">{i.actor ?? "Someone"}</strong><SourceBadge source={i.source} /><span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{new Date(i.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></p>
              <p className="mt-1 text-[13px]">{i.message}</p>
              <p className="text-[11.5px] text-muted-foreground">{i.title}</p>
              {declining === i.id ? (
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why not? (they'll see this)" aria-label="Reason" className="h-8 min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus:border-primary/50" />
                  <button type="button" disabled={decline.isPending} onClick={() => decline.mutate({ i, why: reason })} className="h-8 rounded-md bg-destructive px-3 text-[12px] font-semibold text-white disabled:opacity-50">Decline</button>
                  <button type="button" onClick={() => { setDeclining(null); setReason(""); }} className="h-8 rounded-md px-2 text-[12px] text-muted-foreground hover:text-foreground">Cancel</button>
                </span>
              ) : (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={approve.isPending} onClick={() => approve.mutate(i)} className="flex items-center gap-1 rounded-md bg-forest px-2.5 py-1 text-[12px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                  <button type="button" onClick={() => setDeclining(i.id)} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold hover:bg-accent"><ThumbsDown className="h-3.5 w-3.5" /> Decline</button>
                  <button type="button" onClick={() => { read.mutate(i); showTask(i.task!.source, i.task!.id); }} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-accent"><MessageSquareReply className="h-3.5 w-3.5" /> Open task</button>
                </span>
              )}
            </li>
          ))}
          {tab === "approvals" && !approvals.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">No approval requests. When someone mentions you asking to approve or sign off on something in a task, it shows up here.</li>}
          {tab === "foryou" ? forYou.map((i) => {
            const K = KIND[i.kind] ?? KIND.comment;
            return (
              <li key={`${i.source}-${i.id}`} className="rounded-lg border border-border">
                <button type="button" onClick={() => open(i)} className="flex w-full items-start gap-3 rounded-t-lg px-3 py-2 text-left text-[13px] hover:bg-accent/50">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><K.icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-semibold">{i.title}</span><SourceBadge source={i.source} /></span>
                    <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted-foreground">{i.message}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-muted-foreground">{K.label} · {new Date(i.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                  {i.href && <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
                {(i.task || (i.actorId && i.actorId !== user?.id)) && (
                  <span className="flex gap-1.5 border-t border-border/70 px-3 py-1.5 pl-[52px]">
                    {i.task && <button type="button" onClick={() => { read.mutate(i); showTask(i.task!.source, i.task!.id); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11.5px] font-semibold hover:bg-accent"><MessageSquareReply className="h-3 w-3" /> Open & reply</button>}
                    {i.task && <button type="button" disabled={approve.isPending} onClick={() => approve.mutate(i)} className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11.5px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"><CheckCircle2 className="h-3 w-3" /> Approve</button>}
                    {i.actorId && i.actorId !== user?.id && <button type="button" onClick={() => { read.mutate(i); const [f, ...l] = (i.actor ?? "them").split(" "); setReplyTo({ id: i.actorId!, firstName: f ?? "them", lastName: l.join(" "), avatarUrl: null }); }} className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:bg-accent"><MessageSquare className="h-3 w-3" /> Message {i.actor?.split(" ")[0] ?? "back"}</button>}
                  </span>
                )}
              </li>
            );
          }) : tab === "companies" ? data.attention.companies.map((c) => (
            <li key={c.key}><button type="button" onClick={() => onPick(c.key)} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-accent/50"><span className="flex-1 font-medium">{c.name}</span><SourceBadge source={c.source} /><span className="font-mono text-[12px] text-destructive">{c.overdue} overdue</span><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></button></li>
          )) : tab === "overdue" ? overdue.map((o) => (
            <li key={`${o.source}-${o.task.id}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]"><span className="min-w-0 flex-1"><button type="button" onClick={() => showTask(o.source, o.task.id)} className="block max-w-full truncate text-left font-medium hover:text-primary hover:underline">{o.task.name}</button><span className="block truncate text-[11.5px] text-muted-foreground">{o.company} / {o.where} · {o.people.join(", ") || "unassigned"}</span></span><SourceBadge source={o.source} /><span className="font-mono text-[12px] font-semibold text-destructive">{fmtDate(o.due)}</span></li>
          )) : null}
          {tab === "companies" && !data.attention.companies.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">Every company is healthy.</li>}
          {tab === "foryou" && !forYou.length && <li className="py-6 text-center text-[12.5px] text-muted-foreground">Nothing waiting for you. Assignments, mentions, replies and messages for you show up here.</li>}
        </ul>
      {replyTo && <MessageDialog person={replyTo} onClose={() => setReplyTo(null)} />}
      </DialogContent>
    </Dialog>
  );
}
