"use client";

/* Task ⋯ menu dialogs: Merge, Convert to, Templates, Description history, Send email to task. */

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, FileClock, GitMerge, LayoutTemplate, Mail, Repeat, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkTaskDetail, type WorkUser } from "@/services/work.api";

export type TaskDialog = "merge" | "convert" | "templates" | "history" | "email";
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;

export const TASK_TYPES = [
  { id: "task", label: "Task", color: "#475569" },
  { id: "milestone", label: "Milestone", color: "#7C3AED" },
  { id: "bug", label: "Bug", color: "#DC2626" },
  { id: "request", label: "Request", color: "#0D9488" },
] as const;

function useRefresh(task: WorkTaskDetail) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: workKeys.task(task.uid) });
    qc.invalidateQueries({ queryKey: workKeys.tasks(task.listId) });
    qc.invalidateQueries({ queryKey: workKeys.comments(task.id) });
  };
}

/** search tasks in the workspace (other than this one) */
function TaskSearch({ ws, exclude, selected, onToggle, single, filter }: { ws: string; exclude: number; selected: string[]; onToggle: (uid: string) => void; single?: boolean; filter?: (t: { parentId: number | null }) => boolean }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["work", "all-tasks", ws], queryFn: () => workApi.allTasks(ws), staleTime: 30_000 });
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((t) => t.id !== exclude && !t.completedAt && (!filter || filter(t)) && (!term || t.name.toLowerCase().includes(term))).slice(0, 60);
  }, [data, q, exclude, filter]);
  return (
    <div>
      <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="w-full bg-transparent text-[13px] outline-none" />
      </label>
      <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border">
        {isLoading && <li className="p-3 text-[12.5px] text-muted-foreground">Loading…</li>}
        {!isLoading && !rows.length && <li className="p-3 text-[12.5px] text-muted-foreground">No tasks found.</li>}
        {rows.map((t) => {
          const on = selected.includes(t.uid);
          return (
            <li key={t.id}>
              <button type="button" aria-pressed={on} onClick={() => onToggle(t.uid)} className={cn("flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-accent", on && "bg-primary/5")}>
                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center border", single ? "rounded-full" : "rounded", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="h-3 w-3" />}</span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="max-w-[40%] truncate text-[11.5px] text-muted-foreground">{t.list.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Shell({ open, onClose, icon: Icon, title, hint, children }: { open: boolean; onClose: () => void; icon: typeof Mail; title: string; hint: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {title}</DialogTitle>
        <DialogDescription>{hint}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function TaskMenuDialogs({ task, open, onClose, onOpenTask }: { task: WorkTaskDetail; open: TaskDialog | null; onClose: () => void; onOpenTask: (uid: string) => void }) {
  if (!open) return null;
  const props = { task, onClose, onOpenTask };
  if (open === "merge") return <MergeDialog {...props} />;
  if (open === "convert") return <ConvertDialog {...props} />;
  if (open === "templates") return <TemplatesDialog {...props} />;
  if (open === "history") return <HistoryDialog {...props} />;
  return <EmailDialog {...props} />;
}

type P = { task: WorkTaskDetail; onClose: () => void; onOpenTask: (uid: string) => void };

function MergeDialog({ task, onClose }: P) {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const refresh = useRefresh(task);
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const merge = useMutation({
    mutationFn: async () => (await api.post<{ merged: number }>(`/work/tasks/${task.uid}/merge`, { sourceUids: picked })).data,
    onSuccess: (r) => { refresh(); qc.invalidateQueries({ queryKey: ["work", "all-tasks", ws] }); qc.invalidateQueries({ queryKey: ["work", "tasks"] }); toast.success(`Merged ${r.merged} ${r.merged === 1 ? "task" : "tasks"} into this one`); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't merge.")),
  });
  return (
    <Shell open onClose={onClose} icon={GitMerge} title={`Merge into “${task.name}”`} hint="Comments, files, subtasks, checklists, time and assignees of the tasks you pick move into this task. Those tasks are then archived.">
      <TaskSearch ws={ws} exclude={task.id} selected={picked} onToggle={(u) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : [...p, u]))} />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
        <button type="button" disabled={!picked.length || merge.isPending} onClick={() => merge.mutate()} className="h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Merge {picked.length || ""}</button>
      </div>
    </Shell>
  );
}

function ConvertDialog({ task, onClose, onOpenTask }: P) {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const refresh = useRefresh(task);
  const qc = useQueryClient();
  const [to, setTo] = useState<"subtask" | "task" | "list">(task.parentId ? "task" : "subtask");
  const [parent, setParent] = useState<string | null>(null);
  const go = useMutation({
    mutationFn: async () => (await api.post<{ list?: { uid: string } }>(`/work/tasks/${task.uid}/convert`, { to, ...(to === "subtask" ? { parentUid: parent } : {}) })).data,
    onSuccess: (r) => {
      refresh(); qc.invalidateQueries({ queryKey: ["work", "tasks"] }); qc.invalidateQueries({ queryKey: workKeys.tree(ws) });
      if (to === "list" && r.list) { toast.success("Converted to a list"); onClose(); router.push(`/work/${ws}/list/${r.list.uid}`); return; }
      toast.success(to === "subtask" ? "Now a subtask" : "Now a task"); onClose(); onOpenTask(task.uid);
    },
    onError: (e) => toast.error(errMsg(e, "Couldn't convert.")),
  });
  const opts = [
    ...(task.parentId ? [{ id: "task" as const, label: "Task", hint: "Make it a top-level task" }] : [{ id: "subtask" as const, label: "Subtask", hint: "Put it under another task" }]),
    ...(!task.parentId && task.access.canManage ? [{ id: "list" as const, label: "List", hint: "A new list; its subtasks become the list's tasks" }] : []),
  ];
  return (
    <Shell open onClose={onClose} icon={Repeat} title="Convert to" hint={`Change what “${task.name}” is.`}>
      <div className="flex gap-2">
        {opts.map((o) => (
          <button key={o.id} type="button" aria-pressed={to === o.id} onClick={() => setTo(o.id)} className={cn("flex-1 rounded-lg border px-3 py-2 text-left", to === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent")}>
            <span className="block text-[13px] font-semibold">{o.label}</span>
            <span className="block text-[11.5px] text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </div>
      {to === "subtask" && <div className="mt-3"><p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Parent task</p><TaskSearch ws={ws} exclude={task.id} single selected={parent ? [parent] : []} onToggle={(u) => setParent(parent === u ? null : u)} filter={(t) => !t.parentId} /></div>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
        <button type="button" disabled={(to === "subtask" && !parent) || go.isPending} onClick={() => go.mutate()} className="h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Convert</button>
      </div>
    </Shell>
  );
}

type Tpl = { id: number; name: string; createdById: number; createdAt: string; taskName: string; checklists: number; subtasks: number };

function TemplatesDialog({ task, onClose, onOpenTask }: P) {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const key = ["work", "task-templates", ws];
  const { data: rows = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Tpl[]>(`/work/workspaces/${ws}/task-templates`)).data });
  const [name, setName] = useState(task.name);
  const save = useMutation({
    mutationFn: async () => (await api.post(`/work/tasks/${task.uid}/save-template`, { name })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Saved as a template"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't save the template.")),
  });
  const apply = useMutation({
    mutationFn: async (id: number) => (await api.post<{ uid: string }>(`/work/task-templates/${id}/apply`, { listUid: task.list.uid })).data,
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: workKeys.tasks(task.listId) }); toast.success("Task created from the template", { action: { label: "Open", onClick: () => onOpenTask(t.uid) } }); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't use the template.")),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.delete(`/work/task-templates/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(errMsg(e, "Couldn't delete it.")),
  });
  return (
    <Shell open onClose={onClose} icon={LayoutTemplate} title="Task templates" hint="Save this task (description, priority, checklists, subtasks) to reuse it, or make a new task in this list from a saved one.">
      {task.access.canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Template name" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50" />
          <button type="submit" disabled={save.isPending || !name.trim()} className="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Save as template</button>
        </form>
      )}
      <p className="mt-3 text-[12px] font-medium text-muted-foreground">Saved templates</p>
      <ul className="mt-1 max-h-72 overflow-y-auto rounded-md border border-border">
        {isLoading && <li className="p-3 text-[12.5px] text-muted-foreground">Loading…</li>}
        {!isLoading && !rows.length && <li className="p-3 text-[12.5px] text-muted-foreground">No templates yet.</li>}
        {rows.map((t) => (
          <li key={t.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{t.name}</span>
              <span className="block text-[11.5px] text-muted-foreground">{t.subtasks} subtasks · {t.checklists} checklists</span>
            </span>
            {task.access.canEdit && <button type="button" disabled={apply.isPending} onClick={() => apply.mutate(t.id)} className="rounded-md border border-border px-2 py-1 text-[12px] font-medium hover:bg-accent">Use here</button>}
            <button type="button" aria-label={`Delete template ${t.name}`} onClick={() => window.confirm(`Delete the template "${t.name}"?`) && remove.mutate(t.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

type Version = { id: number; description: string; createdAt: string; user: WorkUser | null };
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function HistoryDialog({ task, onClose }: P) {
  const refresh = useRefresh(task);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["work", "desc-history", task.uid], queryFn: async () => (await api.get<Version[]>(`/work/tasks/${task.uid}/description-history`)).data });
  const [sel, setSel] = useState<number | null>(null);
  const cur = rows.find((r) => r.id === sel) ?? rows[0];
  const restore = useMutation({
    mutationFn: async (id: number) => (await api.post(`/work/description-versions/${id}/restore`)).data,
    onSuccess: () => { refresh(); toast.success("Description restored"); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't restore it.")),
  });
  return (
    <Shell open onClose={onClose} icon={FileClock} title="Description history" hint="Earlier versions of this task's description. Restoring keeps the current one in the history too.">
      {isLoading ? <div className="h-32 animate-pulse rounded-md bg-muted" /> : !rows.length ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">No earlier versions yet. They are saved when someone changes the description.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
          <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
            {rows.map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={cur?.id === r.id} onClick={() => setSel(r.id)} className={cn("block w-full border-b border-border/60 px-2.5 py-2 text-left last:border-b-0 hover:bg-accent", cur?.id === r.id && "bg-primary/5")}>
                  <span className="block text-[12.5px] font-medium">{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{r.user ? userName(r.user) : "Someone"}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-w-0 flex-col">
            <div className="max-h-64 flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-[13px]">{cur ? plain(cur.description) || "(empty)" : ""}</div>
            {task.access.canEdit && cur && <button type="button" disabled={restore.isPending} onClick={() => restore.mutate(cur.id)} className="mt-2 self-end rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50">Restore this version</button>}
          </div>
        </div>
      )}
    </Shell>
  );
}

function EmailDialog({ task, onClose }: P) {
  const qc = useQueryClient();
  const key = ["work", "task-email", task.uid];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ address: string | null; token: string | null; configured: boolean }>(`/work/tasks/${task.uid}/email`)).data });
  const create = useMutation({ mutationFn: async () => (await api.post(`/work/tasks/${task.uid}/email`)).data, onSuccess: (d) => qc.setQueryData(key, d), onError: (e) => toast.error(errMsg(e, "Couldn't make the address.")) });
  const revoke = useMutation({ mutationFn: async () => (await api.delete(`/work/tasks/${task.uid}/email`)).data, onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  return (
    <Shell open onClose={onClose} icon={Mail} title="Send email to task" hint="Emails sent to this task's own address are added as comments on the task.">
      {isLoading ? <div className="h-16 animate-pulse rounded-md bg-muted" /> : !data?.configured ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-[13px] text-muted-foreground">Incoming email isn&apos;t set up on this server yet. An admin needs to set INBOUND_EMAIL_DOMAIN and INBOUND_EMAIL_SECRET and point the email service at it.</p>
      ) : data.address ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-[12.5px]">{data.address}</code>
            <button type="button" aria-label="Copy address" onClick={() => navigator.clipboard.writeText(data.address!).then(() => toast.success("Address copied"))} className="rounded p-1 hover:bg-accent"><Copy className="h-3.5 w-3.5" /></button>
          </div>
          <button type="button" onClick={() => window.confirm("Turn off this address? Emails sent to it will stop arriving.") && revoke.mutate()} className="text-[12px] text-muted-foreground hover:text-destructive">Turn off this address</button>
        </div>
      ) : (
        <button type="button" disabled={create.isPending} onClick={() => create.mutate()} className="rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">Create an email address for this task</button>
      )}
    </Shell>
  );
}
