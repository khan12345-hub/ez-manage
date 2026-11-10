"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Mail, Maximize2, MessageSquare, Network, Plus, Search, UserRound, Users, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDuration, userName, workApi, WORK_ROLE_META, type ProfileTask } from "@/services/work.api";
import { Avatar, DueLabel, PriorityFlag, StatusGlyph } from "./primitives";
import { OnlineDot, OrgChart, directoryKey, localTime, useDirectory, useProfilePanel } from "./people";

type Tab = "activity" | "tasks" | "comments" | "calendar" | "org";
const TZ = ["UTC", "America/Toronto", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Singapore", "Australia/Sydney"];

/** ClickUp-style profile, opened from a hover card, the People pages or the org chart. */
export function ProfilePanel() {
  const { userId, close, open } = useProfilePanel();
  const { workspaceId: ws = "" } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("activity");
  useEffect(() => setTab("activity"), [userId]);
  const key = ["work", "profile", ws, userId];
  const { data: p } = useQuery({ queryKey: key, queryFn: () => workApi.profile(ws, userId!), enabled: !!userId && !!ws });
  const { data: dir } = useDirectory(!!userId);
  const save = useMutation({
    mutationFn: (body: { title?: string | null; timezone?: string | null; managerId?: number | null }) => workApi.updateProfile(ws, userId!, body),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      qc.invalidateQueries({ queryKey: directoryKey(ws) });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't save."),
  });
  const openTask = (t: { uid: string | null; list?: { uid?: string } }) => {
    if (!t.uid) return;
    close();
    router.push(t.list?.uid ? `/work/${ws}/list/${t.list.uid}?task=${t.uid}` : `/work/${ws}/all-tasks?task=${t.uid}`);
  };

  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[720px]">
        <SheetTitle className="sr-only">{p ? userName(p.member.user) : "Profile"}</SheetTitle>
        <SheetDescription className="sr-only">Profile</SheetDescription>
        {!p ? (
          <div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>
        ) : (
          <>
            <header className="flex gap-4 px-6 pb-3 pt-6">
              <span className="relative shrink-0">
                <Avatar user={p.member.user} size={88} className="!rounded-2xl" />
              </span>
              <div className="min-w-0 flex-1 pr-8">
                <h2 className="truncate text-[22px] font-semibold">{userName(p.member.user)}</h2>
                <p className="mt-0.5 flex items-center gap-2 text-[13.5px] text-muted-foreground">
                  {p.canEdit ? (
                    <input
                      key={p.member.title ?? ""}
                      defaultValue={p.member.title ?? ""}
                      placeholder="Add a job title"
                      aria-label="Job title"
                      maxLength={80}
                      onBlur={(e) => e.target.value.trim() !== (p.member.title ?? "") && save.mutate({ title: e.target.value.trim() || null })}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-48 rounded bg-transparent px-1 outline-none hover:bg-accent focus:bg-accent"
                    />
                  ) : (
                    <span>{p.member.title || WORK_ROLE_META[p.member.role]?.label}</span>
                  )}
                  <span aria-hidden className="h-3 w-px bg-border" />
                  <span className="flex items-center gap-1.5"><OnlineDot online={p.online} className="h-2.5 w-2.5 border-0" /> {p.online ? "Online" : "Offline"}</span>
                </p>
                {p.member.status.text && <p className="mt-1 text-[12.5px]">{p.member.status.emoji} {p.member.status.text}</p>}
                <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{WORK_ROLE_META[p.member.role]?.label}</span>
              </div>
            </header>
            <nav role="tablist" aria-label="Profile" className="flex gap-1 overflow-x-auto border-b border-border px-6">
              {([
                ["activity", "Activity"],
                ["tasks", `Tasks (${p.counts.tasks})`],
                ["comments", `Comments (${p.counts.comments})`],
                ["calendar", "Calendar"],
                ["org", "Org Chart"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("-mb-px whitespace-nowrap border-b-2 px-2 pb-2 text-[13px] font-medium", tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "activity" && (
                <ActivityTab
                  ws={ws}
                  userId={userId!}
                  p={p}
                  people={dir?.people ?? []}
                  teams={dir?.teams ?? []}
                  onSave={(b) => save.mutate(b)}
                  onOpenTask={openTask}
                  onOpenPerson={open}
                />
              )}
              {tab === "tasks" && <TasksTab ws={ws} userId={userId!} onOpenTask={openTask} />}
              {tab === "comments" && <CommentsTab ws={ws} userId={userId!} onOpenTask={openTask} />}
              {tab === "calendar" && (
                <section className="px-6 py-5">
                  <h3 className="text-[13.5px] font-semibold">Work schedule</h3>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><CalendarDays className="h-4 w-4" /></span>
                    <span><span className="block text-[13.5px]">Workspace schedule</span><span className="block text-[12px] text-muted-foreground">Mon – Fri • 8h/day • 40h/week</span></span>
                  </div>
                  <h3 className="mt-5 text-[13.5px] font-semibold">No upcoming time off</h3>
                  <div className="mx-auto mt-10 max-w-xs text-center">
                    <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-2 text-[12.5px] text-muted-foreground">Connect a calendar to see upcoming events and calls.</p>
                    {["Google Calendar", "Microsoft Outlook"].map((c) => (
                      <div key={c} className="mt-2 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]">
                        {c} <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Soon</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {tab === "org" && dir && (
                <section className="flex min-h-full flex-col">
                  <div className="flex-1"><OrgChart dir={dir} focusId={userId!} onPick={open} compact /></div>
                  <div className="m-4 flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
                    <Network className="h-5 w-5" />
                    <span className="flex-1">
                      <span className="block text-[13.5px] font-semibold">Explore the full org chart</span>
                      <span className="block text-[12px] text-muted-foreground">{p.reports.length + (p.manager ? 1 : 0)} people in this reporting line</span>
                    </span>
                    <Link href={`/work/${ws}/teams?tab=org&focus=${userId}`} onClick={close} className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">
                      <Maximize2 className="h-3.5 w-3.5" /> Explore
                    </Link>
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActivityTab({
  ws, userId, p, people, teams, onSave, onOpenTask, onOpenPerson,
}: {
  ws: string;
  userId: number;
  p: NonNullable<Awaited<ReturnType<typeof workApi.profile>>>;
  people: { user: { id: number; firstName: string; lastName: string; avatarUrl: string | null }; title: string | null }[];
  teams: { id: number; name: string; color: string }[];
  onSave: (b: { title?: string | null; timezone?: string | null; managerId?: number | null }) => void;
  onOpenTask: (t: any) => void;
  onOpenPerson: (id: number) => void;
}) {
  const qc = useQueryClient();
  const { data: acts = [] } = useQuery({ queryKey: ["work", "profile-activity", ws, userId], queryFn: () => workApi.profileActivity(ws, userId) });
  const { data: tasks } = useQuery({ queryKey: ["work", "profile-tasks", ws, userId], queryFn: () => workApi.profileTasks(ws, userId), enabled: p.canEdit });
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const refreshProfile = () => qc.invalidateQueries({ queryKey: ["work", "profile", ws, userId] });
  const addPri = useMutation({ mutationFn: (taskId: number) => workApi.addPriority(ws, userId, taskId), onSuccess: refreshProfile });
  const dropPri = useMutation({ mutationFn: (taskId: number) => workApi.removePriority(ws, userId, taskId), onSuccess: refreshProfile });
  const lt = localTime(p.member.timezone);
  const candidates = [...(tasks?.today ?? []), ...(tasks?.overdue ?? []), ...(tasks?.next ?? []), ...(tasks?.unscheduled ?? [])].filter((t) => !p.priorities.some((x) => x.id === t.id) && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  const days = new Map<string, typeof acts>();
  for (const a of acts) {
    const k = new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    days.set(k, [...(days.get(k) ?? []), a]);
  }

  return (
    <div>
      <ul className="space-y-3 border-b border-border px-6 py-5 text-[13.5px]">
        <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /> {p.member.user.email}</li>
        <li className="flex items-center gap-3">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          {lt ?? <span className="text-muted-foreground">No time zone</span>}
          {p.canEdit && (
            <select aria-label="Time zone" value={p.member.timezone ?? ""} onChange={(e) => onSave({ timezone: e.target.value || null })} className="ml-auto h-7 rounded-md border border-border bg-background px-1.5 text-[12px]">
              <option value="">Set time zone…</option>
              {TZ.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
        </li>
        <li className="flex items-center gap-3">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {p.manager ? (
            <button type="button" onClick={() => onOpenPerson(p.manager!.user.id)} className="flex items-center gap-1.5 hover:underline">Reports to <Avatar user={p.manager.user} size={18} /> {userName(p.manager.user)}</button>
          ) : (
            <span className="text-muted-foreground">No manager assigned</span>
          )}
          {p.canManage && (
            <select aria-label="Reports to" value={p.manager?.user.id ?? ""} onChange={(e) => onSave({ managerId: e.target.value ? Number(e.target.value) : null })} className="ml-auto h-7 max-w-[180px] rounded-md border border-border bg-background px-1.5 text-[12px]">
              <option value="">No manager</option>
              {people.filter((x) => x.user.id !== userId).map((x) => <option key={x.user.id} value={x.user.id}>{userName(x.user as any)}</option>)}
            </select>
          )}
        </li>
        <li className="flex items-center gap-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          {p.teams.length ? p.teams.map((t) => <span key={t.id} className="rounded-md px-2 py-0.5 text-[12px] font-medium text-white" style={{ background: t.color }}>{t.name}</span>) : <span className="text-muted-foreground">Not in a team</span>}
        </li>
      </ul>

      <section aria-label="Priorities" className="border-b border-border px-6 py-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[13.5px] font-semibold">Priorities</h3>
          <span className="flex-1" />
          {p.canEdit && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild><button type="button" className="flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add</button></PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find one of their open tasks" aria-label="Find task" className="flex-1 bg-transparent text-[13px] outline-none" />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {candidates.map((t) => (
                    <button key={t.id} type="button" onClick={() => { addPri.mutate(t.id); setAddOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                      <StatusGlyph status={t.status as any} size={13} /> <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  {candidates.length === 0 && <p className="px-2 py-3 text-[12px] text-muted-foreground">No open tasks to add.</p>}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {p.priorities.length ? (
          <ol className="space-y-1">
            {p.priorities.map((t, i) => (
              <li key={t.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-accent/40">
                <span className="w-4 text-right font-mono text-[11.5px] text-muted-foreground">{i + 1}</span>
                <StatusGlyph status={t.status as any} size={14} />
                <button type="button" onClick={() => onOpenTask(t)} className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium hover:text-primary">{t.name}</button>
                {t.dueDate && <DueLabel task={t} className="text-[12px]" />}
                <PriorityFlag priority={t.priority} />
                {p.canEdit && <button type="button" aria-label={`Remove ${t.name} from priorities`} onClick={() => dropPri.mutate(t.id)} className="hidden text-muted-foreground hover:text-destructive group-hover:block"><X className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[12.5px] text-muted-foreground">{p.canEdit ? "Add the most important tasks here." : "No priorities set."}</p>
        )}
      </section>

      <section aria-label="Focused on" className="border-b border-border px-6 py-5">
        <h3 className="mb-2 text-[13.5px] font-semibold">Focused on <span className="font-normal text-muted-foreground">· in the last 24 hours</span></h3>
        <FocusList rows={p.focused} onOpen={onOpenTask} />
      </section>

      <section aria-label="Activity" className="px-6 py-5">
        <h3 className="mb-3 text-[13.5px] font-semibold">Activity</h3>
        {acts.length === 0 && <p className="text-[12.5px] text-muted-foreground">No activity yet.</p>}
        {[...days.entries()].map(([day, list]) => (
          <div key={day} className="mb-4">
            <p className="mb-2 text-[12px] text-muted-foreground">{day}</p>
            <ul className="space-y-2">
              {list.map((a) => (
                <li key={a.id} className="rounded-lg border border-border">
                  <button type="button" onClick={() => onOpenTask(a.task)} className="flex w-full items-center gap-2 px-3 pt-2 text-left text-[13.5px] font-semibold hover:text-primary">
                    <StatusGlyph status={a.task.status as any} size={13} /> <span className="truncate">{a.task.name}</span>
                  </button>
                  <p className="px-3 text-[11.5px] text-muted-foreground">{a.task.list.space.name} / {a.task.list.name}</p>
                  <p className="mt-1.5 flex items-center gap-2 border-t border-border/70 px-3 py-1.5 text-[12px] text-muted-foreground">
                    <Avatar user={a.user} size={16} /> {userName(a.user)} {ACTION[a.action] ?? a.action}
                    <span className="ml-auto">{new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

const ACTION: Record<string, string> = {
  created: "created this task", status: "changed the status", name: "renamed the task", priority: "changed the priority", start_date: "changed the start date",
  due_date: "changed the due date", assignees: "changed assignees", estimate: "changed the estimate", tags: "changed tags", moved: "moved the task",
  archived: "archived the task", link: "added a relationship", attachment_added: "attached a file", attachment_removed: "removed a file", field: "updated a field",
};

export function FocusList({ rows, onOpen }: { rows: { task: { uid: string | null; name: string; status: any }; seconds: number; pct: number }[]; onOpen?: (t: any) => void }) {
  if (!rows.length) return <p className="text-[12.5px] text-muted-foreground">No time tracked.</p>;
  const shown = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((a, r) => a + r.pct, 0);
  return (
    <ul className="space-y-1">
      {shown.map((r, i) => (
        <li key={i} className="relative flex items-center gap-2 overflow-hidden rounded-md px-1 py-1 text-[12.5px]" title={formatDuration(r.seconds)}>
          <span aria-hidden className="absolute inset-y-0.5 right-0 rounded bg-emerald-500/15" style={{ width: `${Math.max(r.pct, 4)}%` }} />
          {r.task.uid ? <StatusGlyph status={r.task.status} size={13} /> : <span className="h-3 w-3 rounded-full border border-muted-foreground/50" />}
          <button type="button" disabled={!r.task.uid || !onOpen} onClick={() => onOpen?.(r.task)} className={cn("relative min-w-0 flex-1 truncate text-left", !r.task.uid && "italic text-muted-foreground", r.task.uid && onOpen && "hover:text-primary")}>{r.task.name}</button>
          <span className="relative font-mono text-[11px]">{r.pct}%</span>
        </li>
      ))}
      {rest > 0 && <li className="flex items-center gap-2 px-1 text-[12.5px] text-muted-foreground">··· More <span className="ml-auto font-mono text-[11px]">{rest}%</span></li>}
    </ul>
  );
}

function TasksTab({ ws, userId, onOpenTask }: { ws: string; userId: number; onOpenTask: (t: ProfileTask) => void }) {
  const { data } = useQuery({ queryKey: ["work", "profile-tasks", ws, userId], queryFn: () => workApi.profileTasks(ws, userId) });
  const [openGroups, setOpen] = useState<Record<string, boolean>>({ today: true });
  if (!data) return <div className="m-6 h-24 animate-pulse rounded-xl bg-muted" />;
  const groups: [keyof typeof data, string][] = [["today", "Today"], ["overdue", "Overdue"], ["next", "Next"], ["unscheduled", "Unscheduled"], ["done", "Done"], ["delegated", "Delegated"]];
  return (
    <div>
      {groups.map(([k, label]) => {
        const list = data[k];
        const isOpen = openGroups[k] ?? false;
        return (
          <section key={k} aria-label={label} className="border-b border-border">
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen({ ...openGroups, [k]: !isOpen })} className="flex w-full items-center gap-2 px-6 py-3.5 text-left text-[13.5px] font-semibold hover:bg-accent/30">
              {label} <span className="font-mono text-[12px] font-normal text-muted-foreground">{list.length}</span>
              <span className="flex-1" />
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {isOpen && (
              <ul className="pb-2">
                {list.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => onOpenTask(t)} className="flex w-full items-center gap-2.5 px-6 py-1.5 text-left hover:bg-accent/30">
                      <StatusGlyph status={t.status as any} size={14} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[13.5px]", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{t.list.space.name} / {t.list.name}</span>
                      </span>
                      <PriorityFlag priority={t.priority} />
                      {t.dueDate && !t.completedAt && <DueLabel task={t} className="text-[12px]" />}
                    </button>
                  </li>
                ))}
                {list.length === 0 && <li className="px-6 py-1.5 text-[12.5px] text-muted-foreground">Nothing here.</li>}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CommentsTab({ ws, userId, onOpenTask }: { ws: string; userId: number; onOpenTask: (t: any) => void }) {
  const qc = useQueryClient();
  const [resolved, setResolved] = useState(false);
  const key = ["work", "profile-comments", ws, userId, resolved];
  const { data = [] } = useQuery({ queryKey: key, queryFn: () => workApi.profileComments(ws, userId, resolved) });
  const resolve = useMutation({
    mutationFn: (id: number) => workApi.resolveComment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work", "profile-comments", ws, userId] });
      qc.invalidateQueries({ queryKey: ["work", "profile", ws, userId] });
      toast.success("Resolved");
    },
    onError: () => toast.error("Only the assignee, the author or an admin can resolve this."),
  });
  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-pressed={resolved} onClick={() => setResolved(!resolved)} className={cn("flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px]", resolved ? "border-primary/40 bg-primary/10" : "border-border text-muted-foreground")}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
        </button>
      </div>
      {data.length === 0 && <p className="py-10 text-center text-[13px] text-muted-foreground">{resolved ? "No resolved comments." : "No open assigned comments."}</p>}
      <ul className="space-y-3">
        {data.map((c) => (
          <li key={c.id} className="rounded-xl border border-border">
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5 text-[11.5px] text-muted-foreground">
              <button type="button" onClick={() => onOpenTask(c.task)} className="min-w-0 flex-1 truncate text-left hover:text-foreground">{c.task.list.space.name} / {c.task.list.name} / <span className="font-medium text-foreground">{c.task.name}</span></button>
              {!c.resolvedAt && (
                <button type="button" onClick={() => resolve.mutate(c.id)} className="flex h-6 items-center gap-1 rounded-md border border-border px-2 font-semibold text-foreground hover:bg-accent">
                  <CheckCircle2 className="h-3 w-3" /> Resolve
                </button>
              )}
            </div>
            <div className="flex gap-2.5 px-3 py-2.5">
              <Avatar user={c.user} size={26} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px]"><span className="font-semibold">{userName(c.user)}</span> <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px]">{c.content}</p>
                {c._count.replies > 0 && <p className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-primary"><MessageSquare className="h-3 w-3" /> {c._count.replies} {c._count.replies === 1 ? "reply" : "replies"}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
