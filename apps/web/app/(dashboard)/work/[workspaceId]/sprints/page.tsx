"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Flag, Play, Plus, Trash2, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, type WorkUser } from "@/services/work.api";
import { AvatarStack } from "../../_components/primitives";

type SprintRow = { id: number; name: string; goal: string | null; startDate: string; endDate: string; status: "PLANNED" | "ACTIVE" | "DONE"; tasks: number; done: number; points: number; donePoints: number };
type SprintTask = { id: number; uid: string; name: string; points: number | null; priority: string | null; dueDate: string | null; completedAt: string | null; status: { id: number; name: string; color: string; category: "NOT_STARTED" | "ACTIVE" | "DONE" } | null; list: { uid: string; name: string }; assignees: WorkUser[] };
type Sprint = Omit<SprintRow, "tasks" | "done" | "points" | "donePoints"> & { tasks: SprintTask[]; stats: { tasks: number; done: number; points: number; donePoints: number }; burndown: { day: string; tasks: number | null; points: number | null; ideal: number; idealPoints: number }[] };

const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const d = (s: string) => new Date(s).toLocaleDateString([], { month: "short", day: "numeric" });
const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const STATUS: Record<string, { label: string; cls: string }> = { ACTIVE: { label: "Active", cls: "bg-primary/12 text-primary" }, PLANNED: { label: "Planned", cls: "bg-muted text-muted-foreground" }, DONE: { label: "Done", cls: "bg-[#b08d57]/15 text-[#8a6a35] dark:text-[#d9bd8c]" } };

/** Work → Sprints: time-boxed work with story points, a burndown, and "complete sprint". */
export default function SprintsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: sprints = [], isLoading } = useQuery({ queryKey: ["work", "sprints", ws], queryFn: async () => (await api.get<SprintRow[]>(`/work/workspaces/${ws}/sprints`)).data });
  const selected = Number(sp.get("sprint")) || sprints[0]?.id || null;
  const [creating, setCreating] = useState(false);
  const pick = (id: number) => router.replace(`/work/${ws}/sprints?sprint=${id}`);

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("w-full shrink-0 overflow-y-auto border-r border-border p-4 md:block md:w-[290px]", sp.get("sprint") ? "hidden" : "block")}>
        <PageHeader icon={Zap} title="Sprints"
          actions={<button type="button" onClick={() => setCreating(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New</button>} />
        {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !sprints.length ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">No sprints yet. Create one, add tasks, then start it.</p>
        ) : (
          <ul aria-label="Sprints" className="space-y-1.5">
            {sprints.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => pick(s.id)} aria-current={selected === s.id} className={cn("w-full rounded-xl border p-2.5 text-left", selected === s.id ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/50")}>
                  <span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.name}</span><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", STATUS[s.status]?.cls)}>{STATUS[s.status]?.label}</span></span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{d(s.startDate)} – {d(s.endDate)} · {s.done}/{s.tasks} done{s.points ? ` · ${s.donePoints}/${s.points} pts` : ""}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${s.tasks ? (s.done / s.tasks) * 100 : 0}%` }} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className={cn("min-w-0 flex-1 overflow-y-auto p-4 md:block sm:p-6", sp.get("sprint") ? "block" : "hidden")}>
        <button type="button" onClick={() => router.push(`/work/${ws}/sprints`)} className="mb-3 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium md:hidden">‹ All sprints</button>
        {selected ? <SprintView key={selected} id={selected} ws={ws} sprints={sprints} /> : <p className="py-20 text-center text-muted-foreground">Create your first sprint to plan work in time boxes.</p>}
      </main>
      {creating && <NewSprint ws={ws} onClose={() => setCreating(false)} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["work", "sprints", ws] }); pick(id); }} />}
    </div>
  );
}

function NewSprint({ ws, onClose, onCreated }: { ws: string; onClose: () => void; onCreated: (id: number) => void }) {
  const today = new Date();
  const [name, setName] = useState(`Sprint ${today.toLocaleDateString([], { month: "short", day: "numeric" })}`);
  const [start, setStart] = useState(ymd(today));
  const [end, setEnd] = useState(ymd(new Date(+today + 13 * 86400000)));
  const [goal, setGoal] = useState("");
  const create = useMutation({
    mutationFn: async () => (await api.post<{ id: number }>(`/work/workspaces/${ws}/sprints`, { name: name.trim(), startDate: start, endDate: end, goal: goal.trim() || undefined })).data,
    onSuccess: (s) => { toast.success("Sprint created"); onCreated(s.id); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't create the sprint.")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle>New sprint</DialogTitle>
        <DialogDescription>A time box — usually 1 or 2 weeks. Add tasks, then start it.</DialogDescription>
        <input aria-label="Sprint name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[12px] text-muted-foreground">Starts<input type="date" aria-label="Start date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" /></label>
          <label className="text-[12px] text-muted-foreground">Ends<input type="date" aria-label="End date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" /></label>
        </div>
        <textarea aria-label="Sprint goal" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="Sprint goal (optional)" className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Create sprint</button></div>
      </DialogContent>
    </Dialog>
  );
}

function SprintView({ id, ws, sprints }: { id: number; ws: string; sprints: SprintRow[] }) {
  const qc = useQueryClient();
  const key = ["work", "sprint", id];
  const { data: s } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Sprint>(`/work/sprints/${id}`)).data });
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { data: all = [] } = useQuery({ queryKey: ["work", "all-tasks", ws], queryFn: () => workApi.allTasks(ws), enabled: adding });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["work", "sprints", ws] }); };
  const act = useMutation({
    mutationFn: async (f: () => Promise<unknown>) => f(),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(errMsg(e, "Couldn't do that.")),
  });
  const cols = useMemo(() => {
    const t = s?.tasks ?? [];
    return [
      { id: "todo", label: "To do", tasks: t.filter((x) => !x.completedAt && x.status?.category !== "ACTIVE") },
      { id: "doing", label: "In progress", tasks: t.filter((x) => !x.completedAt && x.status?.category === "ACTIVE") },
      { id: "done", label: "Done", tasks: t.filter((x) => !!x.completedAt) },
    ];
  }, [s]);
  if (!s) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  const daysLeft = Math.ceil((+new Date(s.endDate) - Date.now()) / 86400000);
  const pct = s.stats.tasks ? Math.round((s.stats.done / s.stats.tasks) * 100) : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-[240px] flex-1">
          <p className="flex items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[s.status]?.cls)}>{STATUS[s.status]?.label}</span><span className="text-[12.5px] text-muted-foreground">{d(s.startDate)} – {d(s.endDate)}{s.status === "ACTIVE" ? ` · ${daysLeft > 0 ? `${daysLeft} days left` : "ended"}` : ""}</span></p>
          <h2 className="mt-1 text-[24px] font-semibold leading-tight">{s.name}</h2>
          {s.goal && <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted-foreground"><Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" />{s.goal}</p>}
        </div>
        <span className="flex flex-wrap gap-2">
          {s.status === "PLANNED" && <button type="button" onClick={() => act.mutate(() => api.patch(`/work/sprints/${id}`, { status: "ACTIVE" }))} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Play className="h-4 w-4" /> Start sprint</button>}
          {s.status !== "DONE" && <button type="button" onClick={() => setCompleting(true)} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[13px] font-semibold hover:bg-accent"><CheckCircle2 className="h-4 w-4 text-primary" /> Complete sprint</button>}
          <button type="button" aria-label="Delete sprint" onClick={() => { if (window.confirm(`Delete "${s.name}"? Its tasks stay, they just leave the sprint.`)) act.mutate(() => api.delete(`/work/sprints/${id}`)); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section aria-label="Progress" className="grid grid-cols-2 gap-2">
          {([["Tasks done", `${s.stats.done}/${s.stats.tasks}`], ["Progress", `${pct}%`], ["Points done", `${s.stats.donePoints}/${s.stats.points}`], ["Open", String(s.stats.tasks - s.stats.done)]] as const).map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p><p className="text-[22px] font-semibold tabular-nums">{v}</p></div>
          ))}
        </section>
        <Burndown data={s.burndown} usePoints={s.stats.points > 0} />
      </div>

      <section aria-label="Sprint tasks">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold">Tasks</h3>
          {adding ? (
            <select autoFocus aria-label="Add a task to the sprint" defaultValue="" onBlur={() => setAdding(false)} onChange={(e) => { const tid = Number(e.target.value); setAdding(false); if (tid) act.mutate(() => api.post(`/work/sprints/${id}/tasks`, { add: [tid] })); }} className="h-8 w-[360px] rounded-md border border-border bg-background px-2 text-[13px]">
              <option value="" disabled>{all.length ? "Pick a task…" : "Loading…"}</option>
              {all.filter((t) => !s.tasks.some((x) => x.id === t.id) && !t.completedAt).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.list.name}</option>)}
            </select>
          ) : s.status !== "DONE" && <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add tasks</button>}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {cols.map((c) => (
            <div key={c.id} className="rounded-xl bg-muted/40 p-2.5">
              <p className="mb-2 px-1 text-[12px] font-semibold text-muted-foreground">{c.label} · {c.tasks.length}{c.tasks.some((t) => t.points) ? ` · ${c.tasks.reduce((a, t) => a + (t.points ?? 0), 0)} pts` : ""}</p>
              <ul className="space-y-1.5">
                {c.tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border bg-card p-2.5">
                    <Link href={`/work/${ws}/list/${t.list.uid}?task=${t.uid}`} className={cn("block text-[13px] font-medium hover:text-primary", t.completedAt && "text-muted-foreground line-through")}>{t.name}</Link>
                    <span className="mt-1.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      {t.status && <span className="rounded px-1.5 py-0.5 font-semibold text-white" style={{ background: t.status.color }}>{t.status.name}</span>}
                      <span className="truncate">{t.list.name}</span>
                      <span className="flex-1" />
                      <AvatarStack users={t.assignees} size={20} />
                      <input aria-label={`Points for ${t.name}`} type="number" min={0} max={1000} defaultValue={t.points ?? ""} placeholder="pts" disabled={s.status === "DONE"}
                        onBlur={(e) => { const v = e.target.value === "" ? null : Math.max(0, Math.min(1000, Number(e.target.value))); if (v !== t.points) act.mutate(() => api.patch(`/work/tasks/${t.id}`, { points: v })); }}
                        className="h-6 w-11 rounded border border-border bg-background px-1 text-center font-mono text-[11.5px] text-foreground" />
                      {s.status !== "DONE" && <button type="button" aria-label={`Remove ${t.name} from the sprint`} onClick={() => act.mutate(() => api.post(`/work/sprints/${id}/tasks`, { remove: [t.id] }))} className="rounded p-0.5 hover:bg-accent hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                    </span>
                  </li>
                ))}
                {!c.tasks.length && <li className="px-1 py-3 text-center text-[12px] text-muted-foreground">Nothing here.</li>}
              </ul>
            </div>
          ))}
        </div>
      </section>
      {completing && <CompleteSprint sprint={s} others={sprints.filter((x) => x.id !== id && x.status !== "DONE")} onClose={() => setCompleting(false)} onDone={refresh} />}
    </div>
  );
}

function CompleteSprint({ sprint, others, onClose, onDone }: { sprint: Sprint; others: SprintRow[]; onClose: () => void; onDone: () => void }) {
  const open = sprint.stats.tasks - sprint.stats.done;
  const [moveTo, setMoveTo] = useState<string>(others[0] ? String(others[0].id) : "");
  const done = useMutation({
    mutationFn: async () => (await api.post<{ moved: number }>(`/work/sprints/${sprint.id}/complete`, { moveTo: moveTo ? Number(moveTo) : null })).data,
    onSuccess: (r) => { toast.success(r.moved ? `Sprint complete — ${r.moved} unfinished moved` : "Sprint complete"); onDone(); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't complete it.")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogTitle>Complete {sprint.name}</DialogTitle>
        <DialogDescription>{sprint.stats.done} done, {open} not finished.</DialogDescription>
        {open > 0 && (
          <label className="text-[12.5px] text-muted-foreground">Move the {open} unfinished {open === 1 ? "task" : "tasks"} to
            <select aria-label="Move unfinished to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="">Backlog (no sprint)</option>
            </select>
          </label>
        )}
        <div className="flex justify-end"><button type="button" disabled={done.isPending} onClick={() => done.mutate()} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Complete sprint</button></div>
      </DialogContent>
    </Dialog>
  );
}

/** remaining work per day vs the ideal straight line (one measure, one axis) */
function Burndown({ data, usePoints }: { data: Sprint["burndown"]; usePoints: boolean }) {
  const W = 520, H = 170, L = 28, R = 8, T = 10, B = 22;
  const val = (p: Sprint["burndown"][number]) => (usePoints ? p.points : p.tasks);
  const ideal = (p: Sprint["burndown"][number]) => (usePoints ? p.idealPoints : p.ideal);
  const max = Math.max(1, ...data.map((p) => Math.max(val(p) ?? 0, ideal(p))));
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const actual = data.map((p, i) => (val(p) === null ? null : `${x(i)},${y(val(p)!)}`)).filter(Boolean);
  const every = Math.ceil(data.length / 6);
  return (
    <figure className="rounded-xl border border-border bg-card p-3">
      <figcaption className="mb-1 flex items-center justify-between text-[12.5px]"><span className="font-semibold">Burndown · {usePoints ? "points" : "tasks"} left</span>
        <span className="flex gap-3 text-[11.5px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-0.5 w-3.5 bg-primary" />Remaining</span><span className="flex items-center gap-1"><svg width="14" height="4" aria-hidden><line x1="0" y1="2" x2="14" y2="2" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="3 2" /></svg>Ideal</span></span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Sprint burndown">
        {[0, max / 2, max].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t ? "2 3" : undefined} /><text x={L - 5} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(t)}</text></g>)}
        <polyline points={data.map((p, i) => `${x(i)},${y(ideal(p))}`).join(" ")} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 3" />
        {actual.length > 0 && <polyline points={actual.join(" ")} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />}
        {data.map((p, i) => val(p) !== null && <circle key={p.day} cx={x(i)} cy={y(val(p)!)} r="3" className="fill-primary stroke-card" strokeWidth="1.5"><title>{`${p.day}: ${val(p)} left`}</title></circle>)}
        {data.map((p, i) => (i % every === 0 || i === data.length - 1) && <text key={`l${p.day}`} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{new Date(`${p.day}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}</text>)}
      </svg>
    </figure>
  );
}
