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
  icon: Icon, iconBg, title, description, chips,
}: {
  icon: React.ElementType; iconBg: string; title: string; description: string;
  chips: BannerChip[]; gradient?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-4 flex items-center gap-4 shadow-sm">
      {/* indigo→violet executive wash — opacity-based so it works in light & dark */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/[0.08] via-transparent to-violet-500/[0.07]" />
      <div className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", iconBg)}>
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <div className="relative hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="rounded-full px-3 py-1 text-[11px] font-semibold"
            style={{ background: chip.color + "22", color: chip.color, border: `1px solid ${chip.color}40` }}
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
  accent: string;          // semantic hex — works in light & dark
  urgent?: boolean;
  viz?: React.ReactNode;   // real mini-visualization from live data
}
function KpiCard({ card, onView }: { card: KpiDef; onView: () => void }) {
  const Icon = card.icon;
  const showBtn = (!card.noPanel && card.count > 0) || (card.noPanel && card.viewLabel);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* slim top accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: card.accent }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: card.accent + "16", color: card.accent }}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </div>
        {card.urgent && card.count > 0 && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
      </div>

      <div className="text-[32px] font-black tabular-nums leading-none" style={{ color: card.accent }}>{card.count}</div>
      <div className="text-xs font-bold text-foreground mt-1.5">{card.label}</div>
      <div className="text-[10px] text-muted-foreground">{card.sublabel}</div>

      {card.viz && <div className="mt-3">{card.viz}</div>}

      {showBtn && (
        <button onClick={onView}
          className="mt-3 w-full rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors"
          style={{ borderColor: card.accent + "40", color: card.accent }}
          onMouseEnter={(e) => (e.currentTarget.style.background = card.accent + "14")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          {card.viewLabel ?? `View ${card.count} task${card.count !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

// ─── KPI mini-visualizations (built from live data) ──────────────────────────
function MiniBar({ pct, color, label, right }: { pct: number; color: string; label: string; right: string }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] font-medium text-muted-foreground mb-1">
        <span>{label}</span><span className="tabular-nums" style={{ color }}>{right}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
      </div>
    </div>
  );
}
function SegmentBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-1.5 rounded-full bg-muted overflow-hidden">
        {segments.map((s, i) => s.value > 0 && (
          <div key={i} className="h-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
        {segments.filter((s) => s.value > 0).map((s, i) => (
          <span key={i} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <span className="tabular-nums font-semibold text-foreground">{s.value}</span>
          </span>
        ))}
      </div>
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

  // ── Real mini-viz data (from live overview) ──
  const donePctAll = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const myTaskSegments = useMemo(() => {
    const c = { overdue: 0, due_soon: 0, done: 0, other: 0 };
    for (const t of filteredMyTasks) {
      if (t.category === "overdue")       c.overdue++;
      else if (t.category === "due_soon") c.due_soon++;
      else if (t.category === "done")     c.done++;
      else                                c.other++;
    }
    return [
      { value: c.overdue,  color: "#ef4444", label: "Overdue"  },
      { value: c.due_soon, color: "#f59e0b", label: "Due soon" },
      { value: c.done,     color: "#10b981", label: "Done"     },
      { value: c.other,    color: "#94a3b8", label: "Other"    },
    ];
  }, [filteredMyTasks]);

  const kpiCards: KpiDef[] = [
    { key: "done", label: "Done Tasks", sublabel: "Completed across all", icon: CheckCircle2, count: totalDone,
      accent: "#10b981",
      viz: <MiniBar pct={donePctAll} color="#10b981" label="Completion rate" right={`${donePctAll}%`} /> },
    { key: "next_meeting", label: "Meetings", sublabel: "Upcoming scheduled", icon: CalendarClock, count: upcomingMeetings?.length ?? 0,
      noPanel: true, viewLabel: "Open Meetings →", accent: "#6366f1",
      viz: (
        <div className="flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">Next: {nextMeetingLabel}</span>
        </div>
      ) },
    { key: "my_tasks", label: "My Tasks", sublabel: "Assigned to you", icon: UserCircle2, count: filteredMyTasks.length,
      accent: "#8b5cf6",
      viz: filteredMyTasks.length > 0 ? <SegmentBar segments={myTaskSegments} /> : undefined },
    { key: "due_soon", label: "Due Soon", sublabel: "Upcoming deadlines", icon: AlertTriangle, count: filteredDueSoon, urgent: true,
      accent: "#f59e0b",
      viz: (filteredDueSoon + filteredOverdue) > 0
        ? <SegmentBar segments={[
            { value: filteredDueSoon, color: "#f59e0b", label: "Due soon" },
            { value: filteredOverdue, color: "#ef4444", label: "Overdue"  },
          ]} />
        : undefined },
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
    <div className="min-h-full bg-background ceo-page-surface">

      {/* ══ FILTER BAR ══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/70 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
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
                  className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap shrink-0">
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
                className="w-full rounded-xl border border-border bg-muted/40 pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {searchFocused && globalSearch.length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[200] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  {searchLoading
                    ? <div className="p-3 text-xs text-muted-foreground text-center">Searching…</div>
                    : !searchResults?.length
                    ? <div className="p-3 text-xs text-muted-foreground text-center">No results</div>
                    : <div className="py-1 max-h-48 overflow-y-auto">
                        {searchResults.map((u) => (
                          <button key={u.id} onClick={() => { setProfileUserId(u.id); setGlobalSearch(""); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left transition-colors">
                            <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[9px] font-bold text-white">
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-foreground truncate">{u.firstName} {u.lastName}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{u.email}</div>
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
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Active filter badge ── */}
        {isFiltered && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-muted-foreground">Showing:</span>
            {wsFilter !== "all" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20">
                <Building2 className="h-3 w-3" />{wsFilter}
                <button onClick={() => setWsFilter("all")} className="ml-1 opacity-60 hover:opacity-100">×</button>
              </span>
            )}
            {dateFilter !== "all" && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300 bg-violet-500/10 border border-violet-500/20">
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
              icon={LayoutDashboard} iconBg="bg-primary"
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
                {/* ── 1. KPI summary row — numbers first ── */}
                <div>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">At a glance</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {isLoading
                      ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
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
                </div>

                {/* ── 2. Workspace analysis — primary visual ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">Workspace Task Analysis</span>
                      {wsFilter !== "all" && (
                        <span className="rounded-full bg-primary/5 dark:bg-primary/10 border border-primary/25 dark:border-primary px-2 py-0.5 text-[10px] font-semibold text-primary dark:text-primary">{wsFilter}</span>
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

                {/* ── 3. AI insights, focus & workload — secondary detail ── */}
                <AiInsightsPanel
                  employees={data?.employees ?? []}
                  teamProgress={filteredTeamProg}
                  stats={stats}
                  summary={summary}
                  isLoading={isLoading}
                  onMemberClick={setProfileUserId}
                  onWorkspaceClick={(id, name) => setSelectedWorkspace({ workspaceId: id, workspaceName: name })}
                />
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
