"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import {
  BrainCircuit, RefreshCw, LayoutDashboard, Users, Search,
  AlertTriangle, UserCircle2, CheckCircle2,
  TrendingUp, Calendar, Building2, ChevronDown, SlidersHorizontal, CalendarClock,
  Shield, Mail,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { useCeoAssistantStore } from "@/store/ceo-assistant-store";
import { useTaskOverview } from "./hooks/useTaskOverview";
import { MyTasksSection } from "./components/MyTasksSection";
import { AiInsightsPanel } from "./components/AiInsightsPanel";
import { TeamTab } from "./components/TeamTab";
import { ManagementTab } from "./management/ManagementTab";
import { MeetingsTab } from "./components/MeetingsTab";
import { EmailCenterTab } from "./components/EmailCenterTab";
import { CeoTaskPanel } from "./components/CeoTaskPanel";
import { TaskListPanel } from "./components/TaskListPanel";
import { UserDashboard } from "./components/UserDashboard";
import { WorkspaceDetailPanel } from "./management/components/WorkspaceDetail";
import { searchManagementUsers } from "./management/management.api";
import type { PanelTask } from "./components/TaskListPanel";
import type { EmployeeTaskGroup, MyTaskItem, TeamProgressItem } from "@/services/ceo-assistant.api";
import { getMeetings } from "@/services/ceo-assistant.api";

// ─── helpers ───────────────────────────────────────────────────────────────
function toPanelTasks(employees: EmployeeTaskGroup[], filter: "overdue" | "due_soon" | "inactive"): PanelTask[] {
  return employees.flatMap((e) => {
    const tasks = filter === "overdue" ? e.overdue : filter === "due_soon" ? e.dueSoon : e.inactive;
    return tasks.map((t) => ({
      taskId: t.taskId, taskName: t.taskName, boardName: t.boardName, workspaceName: t.workspaceName,
      groupName: t.groupName, dueDate: t.dueDate, daysOverdue: t.daysOverdue,
      category: filter as any, assigneeName: `${e.user.firstName} ${e.user.lastName}`,
    }));
  });
}
function myToPanelTasks(tasks: MyTaskItem[]): PanelTask[] {
  return tasks.map((t) => ({
    taskId: t.taskId, taskName: t.taskName, boardName: t.boardName, workspaceName: t.workspaceName,
    groupName: t.groupName, dueDate: t.dueDate, daysOverdue: t.daysOverdue, category: t.category,
  }));
}

const PANEL_CFG = {
  overdue:  { title: "Overdue Tasks",  subtitle: "Need immediate attention", accentColor: "#ef4444" },
  done:     { title: "Done Tasks",     subtitle: "Completed tasks",          accentColor: "#10b981" },
  my_tasks: { title: "My Tasks",       subtitle: "Tasks assigned to you",    accentColor: "#8b5cf6" },
  inactive: { title: "Inactive Tasks", subtitle: "No recent activity",       accentColor: "#64748b" },
  due_soon: { title: "Due Soon",       subtitle: "Upcoming deadlines",       accentColor: "#f59e0b" },
} as const;

const DATE_OPTIONS = [
  { value: "all",     label: "All Time"      },
  { value: "week",    label: "This Week"     },
  { value: "month",   label: "This Month"    },
  { value: "quarter", label: "This Quarter"  },
  { value: "year",    label: "This Year"     },
] as const;
type DateFilter = typeof DATE_OPTIONS[number]["value"];

// ─── Date formatting (client-side only) ────────────────────────────────────
function useCurrentDate() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  }, []);
  return label;
}

function getDateFrom(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "week")    return new Date(now.getTime() - 7 * 86_400_000);
  if (filter === "month")   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (filter === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (filter === "year")    return new Date(now.getFullYear(), 0, 1);
  return null;
}

// ─── FilterDropdown ─────────────────────────────────────────────────────────
function FilterSelect({
  icon: Icon, value, options, onChange, placeholder,
}: {
  icon: React.ElementType;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      <Icon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-border bg-background pl-8 pr-7 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer"
      >
        {placeholder && <option value="all">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ─── SectionBanner ──────────────────────────────────────────────────────────
interface BannerChip { label: string; color: string }
function SectionBanner({
  icon: Icon, iconBg, title, description, chips, gradient,
}: {
  icon: React.ElementType; iconBg: string; title: string; description: string;
  chips: BannerChip[]; gradient: string;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center gap-4"
      style={{ background: gradient, border: "1px solid rgba(99,102,241,0.08)" }}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", iconBg)}>
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: chip.color + "18", color: chip.color, border: `1px solid ${chip.color}30` }}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── DonutRing ──────────────────────────────────────────────────────────────
function DonutRing({ pct, color, size = 90 }: { pct: number; color: string; size?: number }) {
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/40" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.9s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black" style={{ color }}>{pct}%</span>
        <span className="text-[9px] text-muted-foreground leading-none">done</span>
      </div>
    </div>
  );
}

// ─── WorkspaceBarChart ───────────────────────────────────────────────────────
function WorkspaceBarChart({ items, isLoading }: { items: TeamProgressItem[]; isLoading: boolean }) {
  if (isLoading) return (
    <div className="space-y-5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
  );
  if (!items.length) return (
    <div className="py-8 text-center text-sm text-muted-foreground">No workspace data for this filter</div>
  );
  const maxTotal = Math.max(...items.map((w) => w.totalTasks), 1);
  return (
    <div className="space-y-5">
      {items.map((ws) => {
        const barW    = Math.max((ws.totalTasks / maxTotal) * 100, ws.totalTasks > 0 ? 3 : 0);
        const tot     = ws.totalTasks || 1;
        const donePct = (ws.doneTasks    / tot) * 100;
        const overPct = (ws.overdueTasks / tot) * 100;
        const soonPct = (ws.dueSoonTasks / tot) * 100;
        const restPct = Math.max(100 - donePct - overPct - soonPct, 0);
        const cpct    = ws.totalTasks > 0 ? Math.round(donePct) : 0;
        const pColor  = cpct >= 75 ? "#10b981" : cpct >= 40 ? "#3b82f6" : "#f59e0b";
        return (
          <div key={ws.workspaceId}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-foreground truncate max-w-[60%]">{ws.workspaceName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">{ws.totalTasks} tasks</span>
                <span className="text-xs font-black" style={{ color: pColor }}>{cpct}%</span>
              </div>
            </div>
            <div className="relative h-8 rounded-xl bg-muted overflow-hidden">
              <div className="absolute inset-y-0 left-0 flex h-full" style={{ width: `${barW}%` }}>
                {donePct > 0 && <div className="h-full" style={{ width: `${donePct}%`, background: "#10b981" }} />}
                {overPct > 0 && <div className="h-full" style={{ width: `${overPct}%`, background: "#ef4444" }} />}
                {soonPct > 0 && <div className="h-full" style={{ width: `${soonPct}%`, background: "#f59e0b" }} />}
                {restPct > 0 && <div className="h-full" style={{ width: `${restPct}%`, background: "#60a5fa" }} />}
              </div>
              <div className="absolute inset-0 flex items-center px-2.5 gap-3">
                {ws.doneTasks > 0    && <span className="text-[10px] font-bold text-white drop-shadow">{ws.doneTasks} done</span>}
                {ws.overdueTasks > 0 && <span className="text-[10px] font-bold text-white drop-shadow ml-auto">{ws.overdueTasks} overdue</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              {ws.doneTasks > 0    && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-500 inline-block" />Done {ws.doneTasks}</span>}
              {ws.overdueTasks > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-red-500 inline-block" />Overdue {ws.overdueTasks}</span>}
              {ws.dueSoonTasks > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-amber-500 inline-block" />Due Soon {ws.dueSoonTasks}</span>}
              <span className="ml-auto flex items-center gap-1"><Users className="h-2.5 w-2.5" />{ws.memberCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
interface KpiDef {
  key: "overdue" | "done" | "my_tasks" | "inactive" | "next_meeting" | "due_soon";
  noPanel?: boolean;
  viewLabel?: string;
  label: string; sublabel: string;
  icon: React.ElementType; count: number;
  numCls: string; bg: string; border: string; iconBg: string; btnCls: string; urgent?: boolean;
}
function KpiCard({ card, onView }: { card: KpiDef; onView: () => void }) {
  const Icon = card.icon;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-md", card.bg, card.border)}>
      <div className="flex items-center justify-between mb-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm", card.iconBg)}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
        {card.urgent && card.count > 0 && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
      </div>
      <div className={cn("text-3xl font-black tabular-nums leading-none", card.numCls)}>{card.count}</div>
      <div className="text-xs font-bold text-foreground/80 mt-1.5">{card.label}</div>
      <div className="text-[10px] text-muted-foreground">{card.sublabel}</div>
      {!card.noPanel && card.count > 0 && (
        <button onClick={onView}
          className={cn("mt-3 w-full rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors", card.btnCls)}>
          {card.viewLabel ?? `View ${card.count} task${card.count !== 1 ? "s" : ""}`}
        </button>
      )}
      {card.noPanel && card.viewLabel && (
        <button onClick={onView}
          className={cn("mt-3 w-full rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors", card.btnCls)}>
          {card.viewLabel}
        </button>
      )}
      <div className={cn("pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10", card.iconBg)} />
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CeoAssistantPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const isOwner = user?.systemRole === "SUPER_ADMIN";

  useEffect(() => {
    if (!authLoading && user && !isOwner) {
      router.replace("/");
    }
  }, [authLoading, user, isOwner]);

  const { filters, setEmployees, activeSection, setActiveSection } = useCeoAssistantStore();
  // Keep local alias so all existing JSX references compile unchanged
  const activeTab    = activeSection;
  const setActiveTab = setActiveSection as (v: string) => void;

  const [selectedTask,    setSelectedTask]     = useState<{ taskId: number; taskName: string } | null>(null);
  const [taskListPanel,   setTaskListPanel]    = useState<"overdue" | "done" | "my_tasks" | "inactive" | "due_soon" | null>(null);
  const [profileUserId,   setProfileUserId]    = useState<number | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ workspaceId: number; workspaceName: string } | null>(null);
  const [globalSearch,    setGlobalSearch]     = useState("");
  const [searchFocused,   setSearchFocused]    = useState(false);

  // ── Global filters ──
  const [wsFilter,   setWsFilter]   = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const currentDate = useCurrentDate();

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["ceo-global-search", globalSearch],
    queryFn: () => searchManagementUsers(globalSearch),
    enabled: globalSearch.length >= 2,
    staleTime: 30_000,
  });

  const { data, isLoading, isError, refetch } = useTaskOverview({
    inactivityDays: filters.inactivityDays,
    upcomingDays:   filters.upcomingDays,
  });

  const { data: upcomingMeetings } = useQuery({
    queryKey: ["ceo-meetings-upcoming"],
    queryFn: () => getMeetings(true),
    staleTime: 60_000,
    enabled: isOwner === true,
  });

  useEffect(() => { if (data?.employees) setEmployees(data.employees); }, [data?.employees]);

  // ── Derived filtered data ──
  const teamProg = data?.teamProgress ?? [];
  const myTasks  = data?.myTasks      ?? [];
  const summary  = data?.summary;
  const stats    = data?.stats ?? { overdueCount: 0, dueSoonCount: 0, inactiveCount: 0, employeeCount: 0 };

  const wsOptions = useMemo(() =>
    teamProg.map((ws) => ({ value: ws.workspaceName, label: ws.workspaceName })),
    [teamProg]);

  const dateFrom = useMemo(() => getDateFrom(dateFilter), [dateFilter]);

  const filteredTeamProg = useMemo(() =>
    wsFilter === "all" ? teamProg : teamProg.filter((ws) => ws.workspaceName === wsFilter),
    [teamProg, wsFilter]);

  const filteredMyTasks = useMemo(() => {
    let tasks = myTasks;
    if (wsFilter !== "all") tasks = tasks.filter((t) => t.workspaceName === wsFilter);
    if (dateFrom)           tasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom);
    return tasks;
  }, [myTasks, wsFilter, dateFrom]);

  // Filtered KPI counts
  const filteredOverdue  = useMemo(() => {
    if (wsFilter === "all" && !dateFrom) return stats.overdueCount;
    let tasks = (data?.employees ?? []).flatMap((e) => e.overdue);
    if (wsFilter !== "all") tasks = tasks.filter((t) => t.workspaceName === wsFilter);
    if (dateFrom)           tasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom);
    return tasks.length;
  }, [data?.employees, wsFilter, dateFrom, stats.overdueCount]);

  const filteredDueSoon = useMemo(() => {
    if (wsFilter === "all" && !dateFrom) return stats.dueSoonCount;
    let tasks = (data?.employees ?? []).flatMap((e) => e.dueSoon);
    if (wsFilter !== "all") tasks = tasks.filter((t) => t.workspaceName === wsFilter);
    if (dateFrom)           tasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) >= dateFrom);
    return tasks.length;
  }, [data?.employees, wsFilter, dateFrom, stats.dueSoonCount]);

  const filteredInactive = useMemo(() => {
    if (wsFilter === "all" && !dateFrom) return stats.inactiveCount;
    let tasks = (data?.employees ?? []).flatMap((e) => e.inactive);
    if (wsFilter !== "all") tasks = tasks.filter((t) => t.workspaceName === wsFilter);
    return tasks.length;
  }, [data?.employees, wsFilter, stats.inactiveCount]);

  const panelTasks = useMemo((): PanelTask[] => {
    if (!taskListPanel || !data) return [];
    if (taskListPanel === "my_tasks") return myToPanelTasks(filteredMyTasks);
    if (taskListPanel === "done")     return myToPanelTasks(filteredMyTasks.filter((t) => t.category === "done"));
    return toPanelTasks(data.employees ?? [], taskListPanel);
  }, [taskListPanel, data, filteredMyTasks]);

  const totalDone  = filteredTeamProg.reduce((sum, ws) => sum + ws.doneTasks,   0);
  const totalTasks = filteredTeamProg.reduce((sum, ws) => sum + ws.totalTasks, 0);

  const nextMeeting = upcomingMeetings?.[0] ?? null;
  const nextMeetingLabel = nextMeeting
    ? (() => {
        const d = new Date(nextMeeting.scheduledAt);
        const now = new Date();
        const diffMs = d.getTime() - now.getTime();
        const diffH = Math.round(diffMs / 3_600_000);
        if (diffH < 1) return "Starting soon";
        if (diffH < 24) return `In ${diffH}h`;
        const diffD = Math.round(diffMs / 86_400_000);
        if (diffD === 1) return "Tomorrow";
        return `In ${diffD} days`;
      })()
    : "No upcoming";

  const kpiCards: KpiDef[] = [
    { key: "done",         label: "Done Tasks",     sublabel: "Completed across all",    icon: CheckCircle2,  count: totalDone,
      numCls: "text-emerald-600", bg: "bg-emerald-50",
      border: "border-emerald-200", iconBg: "bg-emerald-500", btnCls: "border-emerald-300 text-emerald-700 hover:bg-emerald-100" },
    { key: "next_meeting", label: "Meetings",        sublabel: nextMeetingLabel,          icon: CalendarClock, count: upcomingMeetings?.length ?? 0, noPanel: true, viewLabel: "Open Meetings →",
      numCls: "text-indigo-600",  bg: "bg-indigo-50",
      border: "border-indigo-200",  iconBg: "bg-indigo-500",  btnCls: "border-indigo-300 text-indigo-700 hover:bg-indigo-100" },
    { key: "my_tasks",     label: "My Tasks",        sublabel: "Tasks assigned to you",   icon: UserCircle2,   count: filteredMyTasks.length,
      numCls: "text-violet-600",  bg: "bg-violet-50",
      border: "border-violet-200", iconBg: "bg-violet-500", btnCls: "border-violet-300 text-violet-700 hover:bg-violet-100" },
    { key: "due_soon",     label: "Due Soon",        sublabel: "Upcoming deadlines",      icon: AlertTriangle, count: filteredDueSoon,
      numCls: "text-amber-600",   bg: "bg-amber-50",
      border: "border-amber-200", iconBg: "bg-amber-500",   btnCls: "border-amber-300 text-amber-700 hover:bg-amber-100" },
  ];

  if (authLoading || !isOwner) return null;

  // ── Full-page user dashboard ──
  if (profileUserId) {
    return (
      <>
        <UserDashboard
          userId={profileUserId} onBack={() => setProfileUserId(null)}
          onTaskClick={setSelectedTask} onMemberClick={setProfileUserId}
          onWorkspaceClick={(id, name) => setSelectedWorkspace({ workspaceId: id, workspaceName: name })}
        />
        {selectedWorkspace && (
          <WorkspaceDetailPanel
            workspaceId={selectedWorkspace.workspaceId} workspaceName={selectedWorkspace.workspaceName}
            onClose={() => setSelectedWorkspace(null)}
            onTaskClick={(t) => { setSelectedWorkspace(null); setSelectedTask(t); }}
            onMemberClick={(uid) => { setSelectedWorkspace(null); setProfileUserId(uid); }}
          />
        )}
        <CeoTaskPanel
          task={selectedTask} onClose={() => setSelectedTask(null)}
          onWorkspaceClick={(wsName) => {
            const ws = teamProg.find((w) => w.workspaceName === wsName);
            setSelectedTask(null);
            if (ws) setTimeout(() => setSelectedWorkspace({ workspaceId: ws.workspaceId, workspaceName: wsName }), 150);
          }}
        />
      </>
    );
  }

  const isFiltered = wsFilter !== "all" || dateFilter !== "all";

  return (
    <div className="min-h-full" style={{ background: "#f8fafc" }}>

      {/* ══ FILTER BAR ══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30" style={{ background: "rgba(255,255,255,0.95)", borderBottom: "1px solid #e2e8f0", backdropFilter: "blur(10px)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center gap-3 py-2.5">
            {/* Scrollable filter chips — overflow only on this inner strip */}
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <FilterSelect
                icon={Building2}
                value={wsFilter}
                options={wsOptions}
                onChange={setWsFilter}
                placeholder="All Workspaces"
              />
              <FilterSelect
                icon={Calendar}
                value={dateFilter}
                options={DATE_OPTIONS as unknown as { value: string; label: string }[]}
                onChange={(v) => setDateFilter(v as DateFilter)}
              />
              {isFiltered && (
                <button onClick={() => { setWsFilter("all"); setDateFilter("all"); }}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline whitespace-nowrap shrink-0">
                  Clear filters
                </button>
              )}
            </div>

            {/* Search — outside overflow container so dropdown renders freely */}
            <div className="relative shrink-0 w-32 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search member…"
                className="w-full rounded-xl border border-border bg-muted/40 pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
              {searchFocused && globalSearch.length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[200] rounded-xl border border-border bg-white shadow-xl overflow-hidden">
                  {searchLoading
                    ? <div className="p-3 text-xs text-muted-foreground text-center">Searching…</div>
                    : !searchResults?.length
                    ? <div className="p-3 text-xs text-muted-foreground text-center">No results</div>
                    : <div className="py-1 max-h-48 overflow-y-auto">
                        {searchResults.map((u) => (
                          <button key={u.id} onClick={() => { setProfileUserId(u.id); setGlobalSearch(""); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors">
                            <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">{u.firstName} {u.lastName}</div>
                              <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                  }
                </div>
              )}
            </div>

            {/* Refresh */}
            <button onClick={() => refetch()} disabled={isLoading}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40">
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* ══ CONTENT ═════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5">

        {/* ── Active filter badge ── */}
        {isFiltered && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-slate-400">Showing:</span>
            {wsFilter !== "all" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200">
                <Building2 className="h-3 w-3" />{wsFilter}
                <button onClick={() => setWsFilter("all")} className="ml-1 opacity-60 hover:opacity-100">×</button>
              </span>
            )}
            {dateFilter !== "all" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200">
                <Calendar className="h-3 w-3" />{DATE_OPTIONS.find((o) => o.value === dateFilter)?.label}
                <button onClick={() => setDateFilter("all")} className="ml-1 opacity-60 hover:opacity-100">×</button>
              </span>
            )}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <SectionBanner
              icon={LayoutDashboard} iconBg="bg-indigo-500"
              title="Executive Overview"
              description="Real-time task health and performance across your entire organization"
              gradient="linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)"
              chips={[
                { label: `${totalTasks} total tasks`, color: "#6366f1" },
                { label: `${stats.employeeCount} members`, color: "#8b5cf6" },
                { label: `${filteredTeamProg.length} workspaces`, color: "#06b6d4" },
              ]}
            />
            {isError ? (
              <div className="rounded-2xl border border-dashed p-10 text-center">
                <p className="text-sm text-muted-foreground">Failed to load. Ensure OWNER or ADMIN access.</p>
              </div>
            ) : (
              <>
                {/* AI Insights */}
                <AiInsightsPanel
                  employees={data?.employees ?? []}
                  teamProgress={filteredTeamProg}
                  stats={stats}
                  summary={summary}
                  isLoading={isLoading}
                  onMemberClick={setProfileUserId}
                  onWorkspaceClick={(id, name) => setSelectedWorkspace({ workspaceId: id, workspaceName: name })}
                />

                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {isLoading
                    ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
                    : kpiCards.map((card) => (
                        <KpiCard
                          key={card.key}
                          card={card}
                          onView={card.key === "next_meeting"
                            ? () => setActiveTab("meetings")
                            : () => setTaskListPanel(card.key as any)}
                        />
                      ))
                  }
                </div>

                {/* Analytics */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-border">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
                      <span className="text-sm font-bold text-foreground">Workspace Task Analysis</span>
                      {wsFilter !== "all" && (
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">{wsFilter}</span>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                      {[{c:"#10b981",l:"Done"},{c:"#ef4444",l:"Overdue"},{c:"#f59e0b",l:"Due Soon"},{c:"#60a5fa",l:"On Track"}].map(({c,l})=>(
                        <span key={l} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-sm" style={{background:c}} />{l}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-5">
                    <WorkspaceBarChart items={filteredTeamProg} isLoading={isLoading} />
                  </div>
                </div>

              </>
            )}
          </div>
        )}

        {/* ── TEAM ── */}
        {activeTab === "team" && (
          <div className="space-y-5">
            <SectionBanner
              icon={Users} iconBg="bg-blue-500"
              title="Team Performance"
              description="Monitor workload, task distribution and activity across all team members"
              gradient="linear-gradient(135deg,#eff6ff 0%,#eef2ff 100%)"
              chips={[
                { label: `${stats.employeeCount} members`, color: "#3b82f6" },
                { label: `${totalDone} completed`, color: "#10b981" },
                { label: `${stats.overdueCount} overdue`, color: "#ef4444" },
              ]}
            />
            <TeamTab
              teamProgress={filteredTeamProg}
              employees={data?.employees ?? []}
              onMemberClick={setProfileUserId}
              onTaskClick={setSelectedTask}
              onWorkspaceClick={(id, name) => setSelectedWorkspace({ workspaceId: id, workspaceName: name })}
            />
          </div>
        )}

        {/* ── MANAGEMENT ── */}
        {activeTab === "management" && (
          <div className="space-y-5">
            <SectionBanner
              icon={Shield} iconBg="bg-emerald-500"
              title="Management"
              description="Full visibility into member accounts, roles, and workspace health"
              gradient="linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 100%)"
              chips={[
                { label: `${filteredTeamProg.length} workspaces`, color: "#10b981" },
                { label: `${stats.employeeCount} members`, color: "#059669" },
              ]}
            />
            <ManagementTab onTaskClick={setSelectedTask} onUserClick={setProfileUserId} />
          </div>
        )}

        {/* ── EMAIL CENTER ── */}
        {activeTab === "email" && (
          <div className="space-y-5">
            <SectionBanner
              icon={Mail} iconBg="bg-sky-500"
              title="Email Center"
              description="Generate AI-drafted emails and send to team members"
              gradient="linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%)"
              chips={[
                { label: `${stats.employeeCount} members`, color: "#0ea5e9" },
              ]}
            />
            <EmailCenterTab />
          </div>
        )}

        {/* ── MEETINGS ── */}
        {activeTab === "meetings" && (
          <div className="space-y-5">
            <SectionBanner
              icon={Calendar} iconBg="bg-violet-500"
              title="Meetings"
              description="Schedule, manage and track team meetings and agendas"
              gradient="linear-gradient(135deg,#f5f3ff 0%,#faf5ff 100%)"
              chips={[
                { label: `${upcomingMeetings?.length ?? 0} upcoming`, color: "#7c3aed" },
                { label: nextMeetingLabel, color: "#8b5cf6" },
              ]}
            />
            <MeetingsTab employees={data?.employees ?? []} />
          </div>
        )}
      </div>

      {/* Panels */}
      {taskListPanel && (
        <TaskListPanel
          title={PANEL_CFG[taskListPanel].title} subtitle={PANEL_CFG[taskListPanel].subtitle}
          tasks={panelTasks} accentColor={PANEL_CFG[taskListPanel].accentColor}
          onClose={() => setTaskListPanel(null)}
          onTaskClick={(t) => { setTaskListPanel(null); setSelectedTask(t); }}
        />
      )}
      {selectedWorkspace && (
        <WorkspaceDetailPanel
          workspaceId={selectedWorkspace.workspaceId} workspaceName={selectedWorkspace.workspaceName}
          onClose={() => setSelectedWorkspace(null)}
          onTaskClick={(t) => { setSelectedWorkspace(null); setSelectedTask(t); }}
          onMemberClick={(uid) => { setSelectedWorkspace(null); setProfileUserId(uid); }}
        />
      )}
      <CeoTaskPanel
        task={selectedTask} onClose={() => setSelectedTask(null)}
        onWorkspaceClick={(wsName) => {
          const ws = teamProg.find((w) => w.workspaceName === wsName);
          setSelectedTask(null);
          if (ws) setTimeout(() => setSelectedWorkspace({ workspaceId: ws.workspaceId, workspaceName: wsName }), 150);
        }}
      />
    </div>
  );
}
