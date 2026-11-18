"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "../../_components/PageHeader";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, Plus, Timer, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, type WorkUser } from "@/services/work.api";
import { Avatar } from "../../_components/primitives";

type Row = { task: { id: number; uid: string; name: string; listName: string; listUid: string }; seconds: number[]; total: number; billable: number };
type Mine = { user: WorkUser | null; days: string[]; rows: Row[]; totals: number[]; total: number; billable: number; canManage: boolean };
type Team = { days: string[]; people: { user: WorkUser; seconds: number[]; total: number; billable: number }[]; totals: number[]; total: number };

const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (s: number) => (s ? `${Math.floor(s / 3600)}:${String(Math.round((s % 3600) / 60)).padStart(2, "0")}` : "");
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString([], { weekday: "short", day: "numeric" });
/** "1.5", "1:30", "90m" → seconds */
function parseTime(v: string): number | null {
  const t = v.trim().toLowerCase();
  if (!t) return 0;
  let m = /^(\d+):(\d{1,2})$/.exec(t); if (m) return +m[1]! * 3600 + +m[2]! * 60;
  m = /^(\d+(?:\.\d+)?)\s*m$/.exec(t); if (m) return Math.round(+m[1]! * 60);
  m = /^(\d+(?:\.\d+)?)\s*h?$/.exec(t); if (m) return Math.round(+m[1]! * 3600);
  return null;
}

/**
 * Work → Timesheets: your week of tracked time per task (type into a day to add time), or the
 * team's hours per person (admins). Uses the same time entries as the task timer.
 */
export default function TimesheetsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const viewParam = useSearchParams().get("view");
  const [view, setView] = useState<"mine" | "team">(viewParam === "team" ? "team" : "mine");
  useEffect(() => { setView(viewParam === "team" ? "team" : "mine"); }, [viewParam]);
  const [extra, setExtra] = useState<Row["task"][]>([]);
  const [adding, setAdding] = useState(false);
  const tz = new Date().getTimezoneOffset();
  const wk = ymd(week);
  const { data: mine, isLoading } = useQuery({ queryKey: ["work", "timesheet", ws, wk], queryFn: async () => (await api.get<Mine>(`/work/workspaces/${ws}/timesheet?week=${wk}&tz=${tz}`)).data });
  const { data: team } = useQuery({ queryKey: ["work", "timesheet-team", ws, wk], queryFn: async () => (await api.get<Team>(`/work/workspaces/${ws}/timesheet/team?week=${wk}&tz=${tz}`)).data, enabled: view === "team" && !!mine?.canManage });
  const { data: tasks = [] } = useQuery({ queryKey: ["work", "all-tasks", ws], queryFn: () => workApi.allTasks(ws), enabled: adding });

  const add = useMutation({
    mutationFn: ({ taskId, day, seconds }: { taskId: number; day: string; seconds: number }) =>
      workApi.addTime(taskId, { startedAt: new Date(`${day}T09:00:00`).toISOString(), duration: seconds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "timesheet", ws] }); qc.invalidateQueries({ queryKey: ["work", "timesheet-team", ws] }); toast.success("Time added"); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't add time."),
  });

  const rows: Row[] = useMemo(() => {
    const have = new Set((mine?.rows ?? []).map((r) => r.task.id));
    return [...(mine?.rows ?? []), ...extra.filter((t) => !have.has(t.id)).map((task) => ({ task, seconds: new Array(7).fill(0), total: 0, billable: 0 }))];
  }, [mine, extra]);
  const today = ymd(new Date());

  const commit = (r: Row, i: number, value: string) => {
    const secs = parseTime(value);
    if (secs === null) { toast.error('Type hours like "1.5", "1:30" or "45m".'); return; }
    const cur = r.seconds[i] ?? 0;
    if (secs === cur) return;
    if (secs < cur) { toast.info("To remove time, open the task and delete the entry."); return; }
    add.mutate({ taskId: r.task.id, day: mine!.days[i]!, seconds: secs - cur });
  };
  const csv = () => {
    if (!mine) return;
    const lines = [["Task", "List", ...mine.days, "Total (h)"].join(","), ...rows.map((r) => [`"${r.task.name.replace(/"/g, '""')}"`, `"${r.task.listName}"`, ...r.seconds.map((s) => (s / 3600).toFixed(2)), (r.total / 3600).toFixed(2)].join(","))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `timesheet-${wk}.csv`; a.click();
  };

  return (
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
      <PageHeader icon={Timer} title="Timesheets" subtitle="Time tracked on tasks, by day. Type into a day to add time." actions={<>
        {mine?.canManage && (
          <span role="group" aria-label="View" className="flex rounded-lg border border-border p-0.5">
            {(["mine", "team"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{v === "mine" ? "My timesheet" : "Team"}</button>)}
          </span>
        )}
        <span className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button type="button" aria-label="Previous week" onClick={() => setWeek(new Date(+week - 7 * 86400000))} className="rounded-md p-1.5 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="rounded-md px-2 py-1 text-[12.5px] font-medium hover:bg-accent">{week.toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(+week + 6 * 86400000).toLocaleDateString([], { month: "short", day: "numeric" })}</button>
          <button type="button" aria-label="Next week" onClick={() => setWeek(new Date(+week + 7 * 86400000))} className="rounded-md p-1.5 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
        </span>
        {view === "mine" && <button type="button" onClick={csv} disabled={!rows.length} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"><Download className="h-3.5 w-3.5" /> CSV</button>}
      </>} />

      {view === "team" && mine?.canManage ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-border text-left text-[11.5px] text-muted-foreground"><th className="px-4 py-2 font-medium"><Users className="mr-1 inline h-3.5 w-3.5" />Person</th>{(team?.days ?? []).map((d) => <th key={d} className={cn("px-2 py-2 text-right font-medium", d === today && "text-primary")}>{dayLabel(d)}</th>)}<th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
            <tbody>
              {(team?.people ?? []).map((p) => (
                <tr key={p.user.id} className="border-b border-border/60">
                  <td className="px-4 py-2"><span className="flex items-center gap-2"><Avatar user={p.user} size={24} />{p.user.firstName} {p.user.lastName}</span></td>
                  {p.seconds.map((s, i) => <td key={i} className="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground">{hm(s) || "–"}</td>)}
                  <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">{hm(p.total) || "0:00"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-muted/40 font-semibold"><td className="px-4 py-2">Total</td>{(team?.totals ?? []).map((s, i) => <td key={i} className="px-2 py-2 text-right font-mono tabular-nums">{hm(s) || "–"}</td>)}<td className="px-4 py-2 text-right font-mono tabular-nums">{hm(team?.total ?? 0) || "0:00"}</td></tr></tfoot>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-border text-left text-[11.5px] text-muted-foreground"><th className="px-4 py-2 font-medium">Task</th>{(mine?.days ?? []).map((d) => <th key={d} className={cn("w-[84px] px-1 py-2 text-center font-medium", d === today && "text-primary")}>{dayLabel(d)}</th>)}<th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="h-24 animate-pulse bg-muted/40" /></tr> : !rows.length ? (
                <tr><td colSpan={9} className="px-4 py-10 text-left text-muted-foreground sm:text-center"><span className="sticky left-4 inline-block max-w-[calc(100vw-4rem)] whitespace-normal sm:static sm:max-w-none">No time this week. Start a timer on a task, or add a task below and type hours into a day.</span></td></tr>
              ) : rows.map((r) => (
                <tr key={r.task.id} className="border-b border-border/60">
                  <td className="max-w-[320px] px-4 py-1.5"><Link href={`/work/${ws}/list/${r.task.listUid}?task=${r.task.uid}`} className="block truncate font-medium hover:text-primary hover:underline">{r.task.name}</Link><span className="block truncate text-[11.5px] text-muted-foreground">{r.task.listName}</span></td>
                  {r.seconds.map((s, i) => (
                    <td key={`${r.task.id}-${i}-${s}`} className="px-1 py-1.5">
                      <input aria-label={`${r.task.name} on ${dayLabel(mine!.days[i]!)}`} defaultValue={hm(s)} placeholder="–" disabled={add.isPending || mine!.days[i]! > today} title={mine!.days[i]! > today ? "Future days can't have time yet" : undefined}
                        onBlur={(e) => commit(r, i, e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className="h-8 w-full rounded-md border border-transparent bg-transparent text-center font-mono tabular-nums outline-none hover:border-border focus:border-primary/50 focus:bg-background disabled:cursor-not-allowed disabled:opacity-40" />
                    </td>
                  ))}
                  <td className="px-4 py-1.5 text-right font-mono font-semibold tabular-nums">{hm(r.total) || "0:00"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-semibold"><td className="px-4 py-2">Total{mine?.billable ? <span className="ml-2 text-[11.5px] font-normal text-muted-foreground">({hm(mine.billable)} billable)</span> : null}</td>{(mine?.totals ?? []).map((s, i) => <td key={i} className="px-1 py-2 text-center font-mono tabular-nums">{hm(s) || "–"}</td>)}<td className="px-4 py-2 text-right font-mono tabular-nums">{hm(mine?.total ?? 0) || "0:00"}</td></tr>
            </tfoot>
          </table>
          <div className="border-t border-border px-4 py-2">
            {adding ? (
              <select autoFocus aria-label="Add a task to this week" defaultValue="" onChange={(e) => { const t = tasks.find((x) => x.id === Number(e.target.value)); if (t) setExtra((x) => [...x, { id: t.id, uid: t.uid, name: t.name, listName: t.list.name, listUid: t.list.uid }]); setAdding(false); }}
                onBlur={() => setAdding(false)} className="h-8 w-full max-w-[420px] rounded-md border border-border bg-background px-2 text-[13px]">
                <option value="" disabled>{tasks.length ? "Pick a task…" : "Loading tasks…"}</option>
                {tasks.filter((t) => !rows.some((r) => r.task.id === t.id)).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.list.name}</option>)}
              </select>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add a task to this week</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
