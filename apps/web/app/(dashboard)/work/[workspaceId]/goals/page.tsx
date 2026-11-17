"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Goal as GoalIcon, Plus, Target, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, type WorkUser } from "@/services/work.api";
import { Avatar } from "../../_components/primitives";

type TargetT = { id: number; name: string; kind: "NUMBER" | "CURRENCY" | "TRUE_FALSE" | "TASKS"; startVal: number; targetVal: number; current: number; unit: string | null; list: { id: number; uid: string; name: string } | null; progress: number };
type GoalT = { id: number; name: string; description: string | null; color: string; dueDate: string | null; owner: WorkUser | null; targets: TargetT[]; progress: number };
const KIND_LABEL: Record<TargetT["kind"], string> = { NUMBER: "Number", CURRENCY: "Currency", TRUE_FALSE: "Done / not done", TASKS: "Tasks in a list" };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const fmt = (t: TargetT, v: number) => (t.kind === "CURRENCY" ? `${t.unit ?? "$"}${v.toLocaleString()}` : `${v.toLocaleString()}${t.unit ? ` ${t.unit}` : ""}`);

function Ring({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% done`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-muted" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="fill-foreground text-[12px] font-semibold">{value}%</text>
    </svg>
  );
}

/** Work → Goals: measurable goals with targets (numbers, money, done / not done, or a list's tasks). */
export default function GoalsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const key = ["work", "goals", ws];
  const { data: goals = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<GoalT[]>(`/work/workspaces/${ws}/goals`)).data });
  const [open, setOpen] = useState<number | null>(null);
  const goalParam = useSearchParams().get("goal");
  useEffect(() => { if (goalParam) setOpen(Number(goalParam) || null); }, [goalParam]);
  const [creating, setCreating] = useState(false);
  const goal = goals.find((g) => g.id === open) ?? null;
  const set = (g: GoalT) => qc.setQueryData<GoalT[]>(key, (old) => (old ?? []).map((x) => (x.id === g.id ? g : x)));
  const act = useMutation({ mutationFn: async (f: () => Promise<{ data: GoalT }>) => (await f()).data, onSuccess: set, onError: (e) => toast.error(errMsg(e, "Couldn't save.")) });

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><GoalIcon className="h-5 w-5" /></span>
        <span className="min-w-[200px] flex-1"><h1 className="text-[22px] font-semibold leading-tight">Goals</h1><p className="text-[12.5px] text-muted-foreground">Set targets and watch progress — task targets update by themselves as work gets done.</p></span>
        <button type="button" onClick={() => setCreating(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New goal</button>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <ul aria-label="Goals" className="grid content-start gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
          {isLoading ? [0, 1].map((i) => <li key={i} className="h-24 animate-pulse rounded-xl bg-muted" />) : !goals.length ? (
            <li className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">No goals yet. Create one and add targets.</li>
          ) : goals.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => setOpen(g.id)} aria-current={open === g.id} className={cn("flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left", open === g.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:bg-accent/40")}>
                <Ring value={g.progress} color={g.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{g.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">{g.targets.length} {g.targets.length === 1 ? "target" : "targets"}{g.dueDate && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(g.dueDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>}</span>
                </span>
                {g.owner && <Avatar user={g.owner} size={26} />}
              </button>
            </li>
          ))}
        </ul>
        {goal ? <GoalDetail key={goal.id} ws={ws} goal={goal} act={act} onDeleted={() => { setOpen(null); qc.invalidateQueries({ queryKey: key }); }} /> : goals.length > 0 && <p className="rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-muted-foreground">Pick a goal to see and update its targets.</p>}
      </div>
      {creating && <NewGoal ws={ws} onClose={() => setCreating(false)} onCreated={(g) => { qc.setQueryData<GoalT[]>(key, (old) => [g, ...(old ?? [])]); setOpen(g.id); }} />}
    </div>
  );
}

function NewGoal({ ws, onClose, onCreated }: { ws: string; onClose: () => void; onCreated: (g: GoalT) => void }) {
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#047857");
  const create = useMutation({
    mutationFn: async () => (await api.post<GoalT>(`/work/workspaces/${ws}/goals`, { name: name.trim(), dueDate: due || null, description: description.trim() || undefined, color })).data,
    onSuccess: (g) => { onCreated(g); toast.success("Goal created — now add targets"); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't create the goal.")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle>New goal</DialogTitle>
        <DialogDescription>e.g. &quot;Close Q4 launch&quot; or &quot;Reach $50k revenue&quot;.</DialogDescription>
        <input aria-label="Goal name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" maxLength={200} className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <textarea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Why it matters (optional)" className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
        <div className="flex items-center gap-3">
          <label className="flex-1 text-[12px] text-muted-foreground">Due<input type="date" aria-label="Goal due date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" /></label>
          <span className="flex gap-1.5 pt-4">{["#047857", "#2563EB", "#B08D57", "#9333EA", "#DC2626"].map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("h-6 w-6 rounded-full", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />)}</span>
        </div>
        <div className="flex justify-end"><button type="button" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Create goal</button></div>
      </DialogContent>
    </Dialog>
  );
}

function GoalDetail({ ws, goal, act, onDeleted }: { ws: string; goal: GoalT; act: { mutate: (f: () => Promise<{ data: GoalT }>) => void; isPending: boolean }; onDeleted: () => void }) {
  const [adding, setAdding] = useState(false);
  const del = useMutation({ mutationFn: () => api.delete(`/work/goals/${goal.id}`), onSuccess: () => { toast.success("Goal deleted"); onDeleted(); } });
  return (
    <section aria-label={goal.name} className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <Ring value={goal.progress} color={goal.color} size={72} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold leading-tight">{goal.name}</h2>
          {goal.description && <p className="mt-1 text-[13px] text-muted-foreground">{goal.description}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">{goal.owner && <span className="flex items-center gap-1.5"><Avatar user={goal.owner} size={18} />{goal.owner.firstName} {goal.owner.lastName}</span>}{goal.dueDate && <span>Due {new Date(goal.dueDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>}</p>
        </div>
        <button type="button" aria-label="Delete goal" onClick={() => window.confirm(`Delete "${goal.name}" and its targets?`) && del.mutate()} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
      <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[13px] font-semibold"><Target className="h-4 w-4 text-primary" /> Targets</h3>
      <ul className="space-y-2">
        {goal.targets.map((t) => (
          <li key={t.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{t.name}</span><span className="text-[11px] text-muted-foreground">{KIND_LABEL[t.kind]}{t.list ? <> · <Link href={`/work/${ws}/list/${t.list.uid}`} className="hover:underline">{t.list.name}</Link></> : null}</span></span>
              {t.kind === "TRUE_FALSE" ? (
                <button type="button" role="switch" aria-checked={t.current >= 1} aria-label={`${t.name} done`} onClick={() => act.mutate(() => api.patch(`/work/goal-targets/${t.id}`, { current: t.current >= 1 ? 0 : 1 }))} className={cn("rounded-md px-2.5 py-1 text-[12px] font-semibold", t.current >= 1 ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")}>{t.current >= 1 ? "Done" : "Not done"}</button>
              ) : t.kind === "TASKS" ? (
                <span className="font-mono text-[12.5px]">{t.current}/{t.targetVal} tasks</span>
              ) : (
                <span className="flex items-center gap-1 text-[12.5px]">
                  <input aria-label={`${t.name} current value`} type="number" defaultValue={t.current} key={t.current} onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== t.current) act.mutate(() => api.patch(`/work/goal-targets/${t.id}`, { current: v })); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="h-7 w-24 rounded-md border border-border bg-background px-2 text-right font-mono" />
                  <span className="text-muted-foreground">of {fmt(t, t.targetVal)}</span>
                </span>
              )}
              <button type="button" aria-label={`Remove ${t.name}`} onClick={() => act.mutate(() => api.delete(`/work/goal-targets/${t.id}`))} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <span className="mt-2 flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${t.progress}%`, background: goal.color }} /></span><span className="w-9 text-right font-mono text-[11px] text-muted-foreground">{t.progress}%</span></span>
          </li>
        ))}
        {!goal.targets.length && <li className="rounded-xl border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">Add a target to measure this goal.</li>}
      </ul>
      {adding ? <NewTarget ws={ws} goalId={goal.id} onDone={(g) => { act.mutate(async () => ({ data: g })); setAdding(false); }} onCancel={() => setAdding(false)} /> : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add target</button>
      )}
    </section>
  );
}

function NewTarget({ ws, goalId, onDone, onCancel }: { ws: string; goalId: number; onDone: (g: GoalT) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TargetT["kind"]>("NUMBER");
  const [start, setStart] = useState("0");
  const [target, setTarget] = useState("100");
  const [unit, setUnit] = useState("");
  const [listId, setListId] = useState("");
  const { data: tree } = useQuery({ queryKey: ["work", "tree", ws], queryFn: () => workApi.tree(ws), enabled: kind === "TASKS" });
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  const add = useMutation({
    mutationFn: async () => (await api.post<GoalT>(`/work/goals/${goalId}/targets`, { name: name.trim(), kind, startVal: Number(start), targetVal: Number(target), unit: unit || undefined, listId: listId ? Number(listId) : undefined })).data,
    onSuccess: onDone,
    onError: (e) => toast.error(errMsg(e, "Couldn't add the target.")),
  });
  const ready = name.trim() && (kind !== "TASKS" || listId) && (kind === "TASKS" || kind === "TRUE_FALSE" || (start !== "" && target !== ""));
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/[0.03] p-3">
      <div className="flex flex-wrap gap-2">
        <input autoFocus aria-label="Target name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New customers" className="h-9 min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 text-[13px]" />
        <select aria-label="Target type" value={kind} onChange={(e) => setKind(e.target.value as TargetT["kind"])} className="h-9 rounded-lg border border-border bg-background px-2 text-[13px]">
          {(Object.keys(KIND_LABEL) as TargetT["kind"][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>
      {(kind === "NUMBER" || kind === "CURRENCY") && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          from <input aria-label="Start value" type="number" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-24 rounded-md border border-border bg-background px-2 text-foreground" />
          to <input aria-label="Target value" type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 w-24 rounded-md border border-border bg-background px-2 text-foreground" />
          <input aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={kind === "CURRENCY" ? "$" : "unit (optional)"} className="h-8 w-28 rounded-md border border-border bg-background px-2 text-foreground" />
        </div>
      )}
      {kind === "TASKS" && (
        <select aria-label="List" value={listId} onChange={(e) => setListId(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px]">
          <option value="">Pick a list — progress = its tasks completed</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      )}
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-[12.5px] text-muted-foreground hover:text-foreground">Cancel</button><button type="button" disabled={!ready || add.isPending} onClick={() => add.mutate()} className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">Add target</button></div>
    </div>
  );
}
