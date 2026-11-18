"use client";

/*
 * The Work sidebar for each rail area (ClickUp style): Inbox, Teams, Docs, Forms, Goals and
 * Timesheet each get their own menu. Home keeps the full sidebar (menu, favorites, spaces, chat).
 */

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity, AtSign, CheckCheck, ChevronRight, Clock, ClipboardList, FilePlus2, FileText, Goal, History, Inbox, LayoutGrid,
  Megaphone, Network, Plus, Search, UserRound, Users, UsersRound, BarChart3, CalendarRange,
} from "lucide-react";
import { workApi } from "@/services/work.api";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useDirectory } from "@/app/(dashboard)/work/_components/people";
import { useInboxCounts } from "@/app/(dashboard)/work/[workspaceId]/inbox/useInboxCounts";

export type WorkArea = "home" | "inbox" | "planner" | "teams" | "dashboards" | "docs" | "forms" | "goals" | "timesheet";
const INBOX_PATHS = ["inbox", "replies", "assigned-comments", "chat/posts", "chat/search"];

/** which rail area a Work path belongs to */
export function areaOf(pathname: string, ws: string): WorkArea {
  const base = `/work/${ws}`;
  if (INBOX_PATHS.some((p) => pathname === `${base}/${p}`)) return "inbox";
  if (pathname.startsWith(`${base}/planner`)) return "planner";
  if (pathname.startsWith(`${base}/dashboards`)) return "dashboards";
  if (pathname.startsWith(`${base}/teams`) || pathname.startsWith(`${base}/people`)) return "teams";
  if (pathname.startsWith(`${base}/docs`)) return "docs";
  if (pathname.startsWith(`${base}/forms`)) return "forms";
  if (pathname.startsWith(`${base}/goals`)) return "goals";
  if (pathname.startsWith(`${base}/timesheets`)) return "timesheet";
  return "home";
}

const ROW = "group flex w-full items-center gap-2.5 rounded-xl px-3 py-[7px] text-[14px] font-medium transition-colors";
const ACTIVE = "bg-primary/[0.09] text-foreground font-semibold [&_svg]:text-primary dark:bg-white/10";
const IDLE = "text-foreground/70 hover:bg-[#f2f4f3] hover:text-foreground dark:hover:bg-white/5";
const SECTION = "flex items-center gap-1 px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

function Item({ href, icon: Icon, label, active, count, onNavigate, dot }: { href: string; icon?: typeof Inbox; label: string; active?: boolean; count?: number | string; onNavigate?: () => void; dot?: string }) {
  return (
    <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(ROW, active ? ACTIVE : IDLE)}>
      {dot ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count !== 0 && <span className="rounded-md border border-black/[0.08] px-1.5 text-[11px] font-medium text-muted-foreground dark:border-white/10">{count}</span>}
    </Link>
  );
}

function Title({ icon: Icon, label }: { icon: typeof Inbox; label: string }) {
  return <p className="flex items-center gap-2 px-3 pb-2 pt-1 text-[15px] font-semibold"><Icon className="h-4 w-4 text-primary" />{label}</p>;
}

type DocRow = { id: number; uid: string; title: string; parentId: number | null; updatedAt: string; createdById?: number };
type FormRow = { id: number; uid: string; name: string; active: boolean; submissions: number };
type GoalRow = { id: number; name: string; color: string; progress: number };

export function WorkAreaNav({ area, ws, pathname, search, canEdit, meId, onNavigate }: { area: WorkArea; ws: string; pathname: string; search: URLSearchParams; canEdit: boolean; meId?: number; onNavigate?: () => void }) {
  const base = `/work/${ws}`;
  const inbox = useInboxCounts();
  const { data: dir } = useDirectory(area === "teams");
  const { data: docs = [] } = useQuery({ queryKey: ["work", "docs", ws], queryFn: async () => (await api.get<DocRow[]>(`/work/workspaces/${ws}/docs`)).data, enabled: area === "docs" });
  const { data: forms = [] } = useQuery({ queryKey: ["work", "forms", ws], queryFn: async () => (await api.get<FormRow[]>(`/work/workspaces/${ws}/forms`)).data, enabled: area === "forms" });
  const { data: dashboards = [] } = useQuery({ queryKey: ["work", "dashboards", ws], queryFn: () => workApi.dashboards(ws), enabled: area === "dashboards" });
  const { data: goals = [] } = useQuery({ queryKey: ["work", "goals", ws], queryFn: async () => (await api.get<GoalRow[]>(`/work/workspaces/${ws}/goals`)).data, enabled: area === "goals" });
  const on = (p: string) => pathname === `${base}/${p}`;
  const router = useRouter();
  const qc = useQueryClient();
  const newDoc = async () => {
    try {
      const d = (await api.post<{ uid: string }>(`/work/workspaces/${ws}/docs`, { title: "Untitled" })).data;
      await qc.invalidateQueries({ queryKey: ["work", "docs", ws] });
      onNavigate?.();
      router.push(`${base}/docs?doc=${d.uid}`);
    } catch (e: any) { toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create the doc."); }
  };

  if (area === "inbox") {
    return (
      <div className="px-3 pb-3">
        <Title icon={Inbox} label="Inbox" />
        <Item href={`${base}/inbox`} icon={Inbox} label="All activity" active={on("inbox")} count={inbox.primaryUnread} onNavigate={onNavigate} />
        <Item href={`${base}/replies`} icon={AtSign} label="Replies" active={on("replies")} onNavigate={onNavigate} />
        <Item href={`${base}/assigned-comments`} icon={CheckCheck} label="Assigned comments" active={on("assigned-comments")} onNavigate={onNavigate} />
        <Item href={`${base}/chat/posts`} icon={Megaphone} label="Posts" active={on("chat/posts")} onNavigate={onNavigate} />
        <Item href={`${base}/chat/search`} icon={Search} label="Search chat" active={on("chat/search")} onNavigate={onNavigate} />
      </div>
    );
  }

  if (area === "teams") {
    const tab = search.get("tab") ?? "people";
    const inTeams = on("teams");
    const mine = (dir?.teams ?? []).filter((t) => meId && t.memberIds.includes(meId));
    return (
      <div className="px-3 pb-3">
        <Title icon={UsersRound} label="Teams" />
        <Item href={`${base}/teams?tab=teams`} icon={LayoutGrid} label="All Teams" active={inTeams && tab === "teams"} count={dir?.teams.length} onNavigate={onNavigate} />
        <Item href={`${base}/teams?tab=people`} icon={Users} label="All People" active={(inTeams && tab === "people") || on("people")} count={dir?.people.length} onNavigate={onNavigate} />
        <Item href={`${base}/teams?tab=org`} icon={Network} label="Org Chart" active={inTeams && tab === "org"} onNavigate={onNavigate} />
        <Item href={`${base}/teams?tab=analytics`} icon={Activity} label="Analytics" active={inTeams && tab === "analytics"} onNavigate={onNavigate} />
        <p className={SECTION}>My Teams</p>
        {mine.length ? mine.map((t) => <Item key={t.id} href={`${base}/teams?tab=teams`} dot={t.color} label={t.name} count={t.memberIds.length} onNavigate={onNavigate} />)
          : <p className="px-3 py-1 text-[12.5px] text-muted-foreground">You&apos;re not in a team yet.</p>}
      </div>
    );
  }

  if (area === "docs") {
    const current = search.get("doc");
    const top = docs.filter((d) => !d.parentId).sort((a, b) => a.title.localeCompare(b.title));
    const recent = [...docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5);
    const mineDocs = meId ? docs.filter((d) => d.createdById === meId && !d.parentId).slice(0, 8) : [];
    const kids = (id: number) => docs.filter((d) => d.parentId === id).length;
    return (
      <div className="px-3 pb-3">
        <div className="flex items-center"><div className="flex-1"><Title icon={FileText} label="Docs" /></div>
          {canEdit && <button type="button" onClick={newDoc} aria-label="New doc" title="New doc" className="mb-2 rounded-md p-1.5 text-muted-foreground hover:bg-[#f2f4f3] hover:text-foreground"><FilePlus2 className="h-4 w-4" /></button>}
        </div>
        <Item href={`${base}/docs`} icon={FileText} label="All docs" active={on("docs") && !current} count={docs.length} onNavigate={onNavigate} />
        {mineDocs.length > 0 && (<><p className={SECTION}><UserRound className="h-3 w-3" /> My docs</p>{mineDocs.map((d) => <Item key={d.uid} href={`${base}/docs?doc=${d.uid}`} icon={FileText} label={d.title} active={current === d.uid} onNavigate={onNavigate} />)}</>)}
        {recent.length > 0 && (<><p className={SECTION}><History className="h-3 w-3" /> Recently edited</p>{recent.map((d) => <Item key={d.uid} href={`${base}/docs?doc=${d.uid}`} icon={FileText} label={d.title} active={current === d.uid} onNavigate={onNavigate} />)}</>)}
        <p className={SECTION}>All pages</p>
        {!top.length && <p className="px-3 py-1 text-[12.5px] text-muted-foreground">No docs yet.</p>}
        {top.map((d) => <Item key={d.uid} href={`${base}/docs?doc=${d.uid}`} icon={kids(d.id) ? ChevronRight : FileText} label={d.title} active={current === d.uid} count={kids(d.id) || undefined} onNavigate={onNavigate} />)}
      </div>
    );
  }

  if (area === "forms") {
    return (
      <div className="px-3 pb-3">
        <div className="flex items-center"><div className="flex-1"><Title icon={ClipboardList} label="Forms" /></div>
          {canEdit && <Link href={`${base}/forms?new=1`} onClick={onNavigate} aria-label="New form" title="New form" className="mb-2 rounded-md p-1.5 text-muted-foreground hover:bg-[#f2f4f3] hover:text-foreground"><Plus className="h-4 w-4" /></Link>}
        </div>
        <Item href={`${base}/forms`} icon={ClipboardList} label="All forms" active={on("forms")} count={forms.length} onNavigate={onNavigate} />
        <p className={SECTION}>Forms</p>
        {!forms.length && <p className="px-3 py-1 text-[12.5px] text-muted-foreground">No forms yet.</p>}
        {forms.map((f) => <Item key={f.id} href={canEdit ? `${base}/forms?edit=${f.id}` : `/wf/${f.uid}`} dot={f.active ? "#16a34a" : "#9ca3af"} label={f.name} count={f.submissions || undefined} onNavigate={onNavigate} />)}
      </div>
    );
  }

  if (area === "goals") {
    const g = Number(search.get("goal"));
    return (
      <div className="px-3 pb-3">
        <Title icon={Goal} label="Goals" />
        <Item href={`${base}/goals`} icon={Goal} label="All goals" active={on("goals") && !g} count={goals.length} onNavigate={onNavigate} />
        <p className={SECTION}>Goals</p>
        {!goals.length && <p className="px-3 py-1 text-[12.5px] text-muted-foreground">No goals yet.</p>}
        {goals.map((x) => <Item key={x.id} href={`${base}/goals?goal=${x.id}`} dot={x.color} label={x.name} count={`${Math.round(x.progress)}%`} active={g === x.id} onNavigate={onNavigate} />)}
      </div>
    );
  }

  if (area === "planner") {
    return (
      <div className="px-3 pb-3">
        <Title icon={CalendarRange} label="Planner" />
        <Item href={`${base}/planner`} icon={CalendarRange} label="My week" active={on("planner")} onNavigate={onNavigate} />
        <Item href={`${base}?view=mine`} icon={UserRound} label="Assigned to me" onNavigate={onNavigate} />
        <Item href={`${base}?view=today`} icon={Clock} label="Today & Overdue" onNavigate={onNavigate} />
        <p className="px-3 pt-3 text-[12px] leading-relaxed text-muted-foreground">Drag tasks onto days to plan your week. Tasks without a date wait under Unscheduled.</p>
      </div>
    );
  }

  if (area === "dashboards") {
    return (
      <div className="px-3 pb-3">
        <Title icon={BarChart3} label="Dashboards" />
        <Item href={`${base}/dashboards`} icon={LayoutGrid} label="All dashboards" count={dashboards.length} active={on("dashboards")} onNavigate={onNavigate} />
        {dashboards.length > 0 && <p className={SECTION}>Dashboards</p>}
        {dashboards.slice(0, 20).map((d) => (
          <Item key={d.uid} href={`${base}/${d.location.type}/${d.location.uid}?v=${d.uid}`} dot={d.location.color} label={`${d.name} · ${d.location.name}`} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  if (area === "timesheet") {
    const team = search.get("view") === "team";
    return (
      <div className="px-3 pb-3">
        <Title icon={Clock} label="Timesheets" />
        <Item href={`${base}/timesheets`} icon={UserRound} label="My timesheet" active={on("timesheets") && !team} onNavigate={onNavigate} />
        <Item href={`${base}/timesheets?view=team`} icon={Users} label="Team timesheet" active={on("timesheets") && team} onNavigate={onNavigate} />
        <p className="px-3 pt-3 text-[12px] leading-relaxed text-muted-foreground">Track time on tasks; this week&apos;s hours add up here. Admins see the whole team.</p>
      </div>
    );
  }
  return null;
}
