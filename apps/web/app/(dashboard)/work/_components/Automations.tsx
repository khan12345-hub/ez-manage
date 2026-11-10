"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { toast } from "sonner";
import { ArrowRight, Bot, CheckCircle2, History, Plus, Sparkles, Trash2, XCircle, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import {
  userName,
  workApi,
  workKeys,
  type AutomationAction,
  type AutomationActionType,
  type AutomationCondition,
  type AutomationTrigger,
  type AutomationTriggerType,
  type WorkAutomation,
} from "@/services/work.api";

/** where the Automations panel is open: a space, a folder or a list */
export type AutomationScope = { spaceId: number; folderId?: number | null; listId?: number | null; listUid?: string | null; label: string };
export const useAutomations = create<{ scope: AutomationScope | null; open: (s: AutomationScope) => void; close: () => void }>((set) => ({
  scope: null,
  open: (scope) => set({ scope }),
  close: () => set({ scope: null }),
}));

const TRIGGERS: { id: AutomationTriggerType; label: string }[] = [
  { id: "task_created", label: "Task created" },
  { id: "status_changed", label: "Status changes" },
  { id: "assignee_added", label: "Assignee added" },
  { id: "priority_changed", label: "Priority changes" },
  { id: "due_date_changed", label: "Due date changes" },
  { id: "comment_added", label: "Comment added" },
  { id: "task_moved", label: "Task moved here" },
];
const ACTIONS: { id: AutomationActionType; label: string }[] = [
  { id: "set_status", label: "Change status" },
  { id: "set_priority", label: "Change priority" },
  { id: "add_assignees", label: "Add assignees" },
  { id: "remove_assignees", label: "Remove assignees" },
  { id: "set_due_date", label: "Set due date" },
  { id: "add_tag", label: "Add a tag" },
  { id: "add_comment", label: "Add a comment" },
  { id: "create_subtask", label: "Create a subtask" },
  { id: "move_to_list", label: "Move to list" },
  { id: "archive", label: "Archive task" },
  { id: "notify", label: "Send a notification" },
];
const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"];
const DEFAULT_STATUSES = ["To do", "In progress", "In review", "Complete"];

const TEMPLATES: { name: string; trigger: AutomationTrigger; actions: (me: number) => AutomationAction[] }[] = [
  { name: "When status changes to Complete, archive the task", trigger: { type: "status_changed", to: "Complete" }, actions: () => [{ type: "archive" }] },
  { name: "When a task is created, assign it to me", trigger: { type: "task_created" }, actions: (me) => [{ type: "add_assignees", userIds: [me] }] },
  { name: "When an assignee is added, set status to In progress", trigger: { type: "assignee_added" }, actions: () => [{ type: "set_status", status: "In progress" }] },
  { name: "When priority changes to Urgent, set due date to tomorrow", trigger: { type: "priority_changed", to: "URGENT" }, actions: () => [{ type: "set_due_date", days: 1 }] },
  { name: "When status changes to In review, notify me", trigger: { type: "status_changed", to: "In review" }, actions: (me) => [{ type: "notify", userIds: [me], message: "A task is ready for review" }] },
  { name: "When a task is created, add a checklist subtask", trigger: { type: "task_created" }, actions: () => [{ type: "create_subtask", name: "Review & sign-off" }] },
];

const label = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;
const sel = "h-8 rounded-md border border-border bg-background px-2 text-[13px] outline-none focus:border-primary/50";

function summary(a: WorkAutomation) {
  const t = a.trigger;
  const when = `${label(TRIGGERS, t.type)}${t.from ? ` from ${t.from}` : ""}${t.to ? ` to ${t.to}` : ""}`;
  return { when, then: a.actions.map((x) => label(ACTIONS, x.type)).join(", ") };
}

/** Automations panel (ClickUp "Automate"): manage, add, templates. Mounted once in the Work sidebar. */
export function AutomationsPanel() {
  const { scope, close } = useAutomations();
  const [tab, setTab] = useState<"manage" | "add" | "templates">("manage");
  const [draft, setDraft] = useState<{ name: string; trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[] } | null>(null);
  const startDraft = (d?: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] }) => {
    setDraft({ name: d?.name ?? "", trigger: d?.trigger ?? { type: "status_changed" }, conditions: [], actions: d?.actions ?? [{ type: "set_status", status: "" }] });
    setTab("add");
  };
  return (
    <Sheet open={!!scope} onOpenChange={(o) => { if (!o) { close(); setTab("manage"); setDraft(null); } }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]">
        <header className="border-b border-border px-6 pb-0 pt-5">
          <SheetTitle className="flex items-center gap-2 text-[18px]"><Zap className="h-4.5 w-4.5 text-[#b08d57]" /> Automations</SheetTitle>
          <SheetDescription className="text-[12.5px]">In {scope?.label}. Rules run on every task here, as the person who created them.</SheetDescription>
          <nav role="tablist" aria-label="Automations" className="mt-3 flex gap-1">
            {([["manage", "Manage"], ["add", "Add Automation"], ["templates", "Templates"]] as const).map(([id, l]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => (id === "add" && !draft ? startDraft() : setTab(id))} className={cn("-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {l}
              </button>
            ))}
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {scope && tab === "manage" && <Manage scope={scope} onAdd={() => startDraft()} />}
          {scope && tab === "add" && draft && <Builder scope={scope} draft={draft} setDraft={setDraft} onDone={() => { setDraft(null); setTab("manage"); }} />}
          {scope && tab === "templates" && <Templates onPick={(t) => startDraft(t)} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Manage({ scope, onAdd }: { scope: AutomationScope; onAdd: () => void }) {
  const qc = useQueryClient();
  const key = ["work", "automations", scope.spaceId, scope.folderId ?? null, scope.listId ?? null];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => workApi.automations(scope.spaceId, scope) });
  const [runsOf, setRunsOf] = useState<number | null>(null);
  const toggle = useMutation({
    mutationFn: (a: WorkAutomation) => workApi.updateAutomation(a.id, { enabled: !a.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["work", "automations"] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't change it."),
  });
  const del = useMutation({
    mutationFn: (id: number) => workApi.deleteAutomation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "automations"] }); toast.success("Automation deleted"); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't delete it."),
  });
  if (isLoading) return <div className="m-6 h-24 animate-pulse rounded-xl bg-muted" />;
  if (!data.length) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#b08d57]/15"><Bot className="h-6 w-6 text-[#b08d57]" /></span>
        <h3 className="mt-3 text-[15px] font-semibold">No automations yet</h3>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Let routine work happen on its own: change statuses, assign people, set due dates, post comments and more.</p>
        <button type="button" onClick={onAdd} className="mt-4 flex h-9 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> Add Automation</button>
      </div>
    );
  }
  return (
    <div className="space-y-3 px-6 py-5">
      <div className="flex items-center">
        <span className="text-[12.5px] text-muted-foreground">{data.filter((a) => a.enabled).length} active</span>
        <span className="flex-1" />
        <button type="button" onClick={onAdd} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><Plus className="h-3.5 w-3.5" /> Add Automation</button>
      </div>
      <ul aria-label="Automation rules" className="space-y-2.5">
        {data.map((a) => {
          const s = summary(a);
          return (
            <li key={a.id} className={cn("rounded-xl border bg-card p-3.5", a.enabled ? "border-border" : "border-dashed border-border opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{a.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{s.when}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="rounded-md bg-[#b08d57]/15 px-1.5 py-0.5 font-medium">{s.then}</span>
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-muted-foreground">
                    {a.inherited && <span className="mr-1.5 rounded bg-muted px-1 py-px">from parent</span>}
                    Ran {a.runCount}×{a.lastRunAt ? ` · last ${new Date(a.lastRunAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""} · by {userName(a.createdBy)}
                  </span>
                </span>
                <Switch checked={a.enabled} onCheckedChange={() => toggle.mutate(a)} aria-label={`${a.enabled ? "Turn off" : "Turn on"} ${a.name}`} />
              </div>
              <div className="mt-2 flex items-center gap-3 border-t border-border/70 pt-2 text-[12px]">
                <button type="button" onClick={() => setRunsOf(runsOf === a.id ? null : a.id)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><History className="h-3.5 w-3.5" /> Run history</button>
                <span className="flex-1" />
                <button type="button" aria-label={`Delete ${a.name}`} onClick={() => window.confirm(`Delete "${a.name}"?`) && del.mutate(a.id)} className="flex items-center gap-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
              {runsOf === a.id && <Runs id={a.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Runs({ id }: { id: number }) {
  const { data = [] } = useQuery({ queryKey: ["work", "automation-runs", id], queryFn: () => workApi.automationRuns(id) });
  if (!data.length) return <p className="mt-2 text-[12px] text-muted-foreground">It hasn&apos;t run yet.</p>;
  return (
    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
      {data.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-[12px]">
          {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
          <span className="min-w-0 flex-1 truncate">{r.ok ? r.message || "done" : r.message}</span>
          <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </li>
      ))}
    </ul>
  );
}

function Templates({ onPick }: { onPick: (t: { name: string; trigger: AutomationTrigger; actions: AutomationAction[] }) => void }) {
  const me = useMeId();
  return (
    <ul aria-label="Automation templates" className="grid grid-cols-1 gap-2.5 px-6 py-5 sm:grid-cols-2">
      {TEMPLATES.map((t) => (
        <li key={t.name}>
          <button type="button" onClick={() => onPick({ name: t.name, trigger: t.trigger, actions: t.actions(me) })} className="flex h-full w-full flex-col gap-2 rounded-xl border border-border bg-card p-3.5 text-left hover:border-primary/40 hover:shadow-sm">
            <Sparkles className="h-4 w-4 text-[#b08d57]" />
            <span className="text-[13px] font-medium leading-snug">{t.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function useMeId() {
  const { user } = useAuth();
  return user?.id ?? 0;
}

function Builder({
  scope,
  draft,
  setDraft,
  onDone,
}: {
  scope: AutomationScope;
  draft: { name: string; trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[] };
  setDraft: (d: typeof draft) => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { data: list } = useQuery({ queryKey: workKeys.list(scope.listUid ?? ""), queryFn: () => workApi.getList(scope.listUid!), enabled: !!scope.listUid });
  const { data: tags = [] } = useQuery({ queryKey: ["work", "tags", scope.spaceId], queryFn: () => workApi.tags(scope.spaceId) });
  const { data: people } = useQuery({ queryKey: ["work", "people", ws], queryFn: () => workApi.people(ws) });
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws) });
  const members = (people?.members ?? []).map((m) => m.user);
  const statuses = useMemo(() => [...new Set([...(list?.statuses.map((s) => s.name) ?? []), ...(list ? [] : DEFAULT_STATUSES)])], [list]);
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, name: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, name: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  const save = useMutation({
    mutationFn: () => workApi.createAutomation(scope.spaceId, { name: draft.name.trim() || undefined, ...(scope.folderId ? { folderId: scope.folderId } : {}), ...(scope.listId ? { listId: scope.listId } : {}), trigger: draft.trigger, conditions: draft.conditions, actions: draft.actions }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "automations"] }); toast.success("Automation created"); onDone(); },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create it."),
  });
  const setTrig = (t: Partial<AutomationTrigger>) => setDraft({ ...draft, trigger: { ...draft.trigger, ...t } });
  const setAct = (i: number, a: Partial<AutomationAction>) => setDraft({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { ...x, ...a } : x)) });
  const statusInput = (value: string | null | undefined, onChange: (v: string | null) => void, aria: string, any = true) => (
    <select aria-label={aria} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={sel}>
      {any && <option value="">Any status</option>}
      {!any && <option value="">Choose…</option>}
      {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
  const peoplePick = (ids: number[] = [], onChange: (ids: number[]) => void) => (
    <span className="flex flex-wrap gap-1">
      {members.map((m) => {
        const on = ids.includes(m.id);
        return (
          <button key={m.id} type="button" aria-pressed={on} onClick={() => onChange(on ? ids.filter((x) => x !== m.id) : [...ids, m.id])} className={cn("rounded-full border px-2 py-0.5 text-[12px]", on ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
            {userName(m)}
          </button>
        );
      })}
    </span>
  );

  return (
    <div className="space-y-5 px-6 py-5">
      <section aria-label="Trigger" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-primary">When</p>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Trigger" value={draft.trigger.type} onChange={(e) => setDraft({ ...draft, trigger: { type: e.target.value as AutomationTriggerType } })} className={sel}>
            {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {draft.trigger.type === "status_changed" && (
            <>
              <span className="text-[12.5px] text-muted-foreground">from</span>{statusInput(draft.trigger.from, (v) => setTrig({ from: v }), "From status")}
              <span className="text-[12.5px] text-muted-foreground">to</span>{statusInput(draft.trigger.to, (v) => setTrig({ to: v }), "To status")}
            </>
          )}
          {draft.trigger.type === "priority_changed" && (
            <>
              <span className="text-[12.5px] text-muted-foreground">to</span>
              <select aria-label="To priority" value={draft.trigger.to ?? ""} onChange={(e) => setTrig({ to: e.target.value || null })} className={sel}>
                <option value="">Any priority</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </select>
            </>
          )}
        </div>
      </section>

      <section aria-label="Conditions" className="rounded-xl border border-dashed border-border p-4">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Only if (optional)</p>
        {draft.conditions.map((c, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <select aria-label="Condition field" value={c.field} onChange={(e) => setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { field: e.target.value as any, op: "is", value: "" } : x)) })} className={sel}>
              <option value="priority">Priority</option><option value="assignee">Assignee</option><option value="tag">Tag</option>
            </select>
            <select aria-label="Condition operator" value={c.op} onChange={(e) => setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as any } : x)) })} className={sel}>
              <option value="is">is</option><option value="is_not">is not</option>
            </select>
            <select aria-label="Condition value" value={String(c.value)} onChange={(e) => setDraft({ ...draft, conditions: draft.conditions.map((x, j) => (j === i ? { ...x, value: c.field === "priority" ? e.target.value : Number(e.target.value) } : x)) })} className={sel}>
              <option value="">Choose…</option>
              {c.field === "priority" && [...PRIORITIES, "NONE"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              {c.field === "assignee" && members.map((m) => <option key={m.id} value={m.id}>{userName(m)}</option>)}
              {c.field === "tag" && tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" aria-label="Remove condition" onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, { field: "priority", op: "is", value: "" }] })} className="flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add condition</button>
      </section>

      <section aria-label="Actions" className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8a6a3a]">Then</p>
        <ol className="space-y-3">
          {draft.actions.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
              <select aria-label={`Action ${i + 1}`} value={a.type} onChange={(e) => setDraft({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { type: e.target.value as AutomationActionType } : x)) })} className={sel}>
                {ACTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
              {a.type === "set_status" && statusInput(a.status, (v) => setAct(i, { status: v ?? "" }), "Set status to", false)}
              {a.type === "set_priority" && (
                <select aria-label="Set priority to" value={a.priority ?? ""} onChange={(e) => setAct(i, { priority: e.target.value || null })} className={sel}>
                  <option value="">Clear priority</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                </select>
              )}
              {(a.type === "add_assignees" || a.type === "remove_assignees" || a.type === "notify") && <div className="w-full pl-4">{peoplePick(a.userIds, (ids) => setAct(i, { userIds: ids }))}</div>}
              {a.type === "notify" && <input aria-label="Notification text" value={a.message ?? ""} onChange={(e) => setAct(i, { message: e.target.value })} placeholder="Message (optional)" className={cn(sel, "ml-4 flex-1")} />}
              {a.type === "set_due_date" && (
                <span className="flex items-center gap-1.5 text-[12.5px]">
                  <input aria-label="Days from now" type="number" value={a.days ?? 1} onChange={(e) => setAct(i, { days: Number(e.target.value) })} className={cn(sel, "w-20")} /> days from now
                </span>
              )}
              {a.type === "add_tag" && (
                <select aria-label="Tag" value={a.tagId ?? ""} onChange={(e) => setAct(i, { tagId: Number(e.target.value) })} className={sel}>
                  <option value="">Choose a tag…</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              {a.type === "add_comment" && <input aria-label="Comment text" value={a.text ?? ""} onChange={(e) => setAct(i, { text: e.target.value })} placeholder="Comment" className={cn(sel, "min-w-[220px] flex-1")} />}
              {a.type === "create_subtask" && <input aria-label="Subtask name" value={a.name ?? ""} onChange={(e) => setAct(i, { name: e.target.value })} placeholder="Subtask name" className={cn(sel, "min-w-[220px] flex-1")} />}
              {a.type === "move_to_list" && (
                <select aria-label="Move to list" value={a.listId ?? ""} onChange={(e) => setAct(i, { listId: Number(e.target.value) })} className={cn(sel, "max-w-[280px]")}>
                  <option value="">Choose a list…</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              )}
              {draft.actions.length > 1 && <button type="button" aria-label={`Remove action ${i + 1}`} onClick={() => setDraft({ ...draft, actions: draft.actions.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ol>
        {draft.actions.length < 10 && (
          <button type="button" onClick={() => setDraft({ ...draft, actions: [...draft.actions, { type: "add_comment", text: "" }] })} className="mt-3 flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /> Add action</button>
        )}
      </section>

      <div className="flex items-center gap-2">
        <input aria-label="Automation name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (optional)" className={cn(sel, "h-9 flex-1")} />
        <button type="button" onClick={onDone} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Create</button>
      </div>
    </div>
  );
}

/** "Automate" button for list / space / folder headers */
export function AutomateButton({ scope }: { scope: AutomationScope }) {
  const open = useAutomations((s) => s.open);
  return (
    <button type="button" onClick={() => open(scope)} className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
      <Zap className="h-3.5 w-3.5" /> Automate
    </button>
  );
}
