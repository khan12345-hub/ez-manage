"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ClipboardList, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi } from "@/services/work.api";

type Field = { id: string; label: string; type: "text" | "textarea" | "email" | "number" | "date" | "select"; required: boolean; options?: string[]; maps?: "name" | "description" | "dueDate" | "priority" | null };
type FormRow = { id: number; uid: string; name: string; description: string | null; listId: number; fields: Field[]; active: boolean; submissions: number; list: { id: number; uid: string; name: string } | null };
const TYPE_LABEL: Record<Field["type"], string> = { text: "Short text", textarea: "Long text", email: "Email", number: "Number", date: "Date", select: "Dropdown" };
const MAP_LABEL: Record<string, string> = { "": "—", name: "Task name", description: "Description", dueDate: "Due date", priority: "Priority (urgent / high / normal / low)" };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const linkOf = (uid: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/wf/${uid}`;

/** Work → Forms: share a link; every answer becomes a task in the list you pick. */
export default function FormsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const key = ["work", "forms", ws];
  const { data: forms = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<FormRow[]>(`/work/workspaces/${ws}/forms`)).data });
  const [editing, setEditing] = useState<FormRow | "new" | null>(null);
  const toggle = useMutation({ mutationFn: (f: FormRow) => api.patch(`/work/forms/${f.id}`, { active: !f.active }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const del = useMutation({ mutationFn: (f: FormRow) => api.delete(`/work/forms/${f.id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Form deleted"); } });

  return (
    <div className="mx-auto max-w-[1100px] p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></span>
        <span className="min-w-[200px] flex-1"><h1 className="text-[22px] font-semibold leading-tight">Forms</h1><p className="text-[12.5px] text-muted-foreground">Share a link — every answer becomes a task in the list you choose.</p></span>
        <button type="button" onClick={() => setEditing("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New form</button>
      </header>
      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !forms.length ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-muted-foreground">No forms yet — e.g. a request form that drops tasks into a list.</p>
      ) : (
        <ul aria-label="Forms" className="space-y-2">
          {forms.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <span className="min-w-[220px] flex-1">
                <span className="block text-[14px] font-semibold">{f.name}</span>
                <span className="text-[12px] text-muted-foreground">{f.fields.length} questions → {f.list ? <Link href={`/work/${ws}/list/${f.list.uid}`} className="hover:underline">{f.list.name}</Link> : "a deleted list"} · {f.submissions} {f.submissions === 1 ? "answer" : "answers"}</span>
              </span>
              <button type="button" role="switch" aria-checked={f.active} aria-label={`${f.name} open`} onClick={() => toggle.mutate(f)} className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold", f.active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>{f.active ? "Open" : "Closed"}</button>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(linkOf(f.uid)); toast.success("Link copied"); }} className="flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[12px] hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy link</button>
              <a href={`/wf/${f.uid}`} target="_blank" rel="noreferrer" aria-label={`Open ${f.name}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /></a>
              <button type="button" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label={`Delete ${f.name}`} onClick={() => window.confirm(`Delete "${f.name}"? Tasks it made stay.`) && del.mutate(f)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {editing && <FormEditor ws={ws} form={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: key })} />}
    </div>
  );
}

function FormEditor({ ws, form, onClose, onSaved }: { ws: string; form: FormRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(form?.name ?? "Request form");
  const [description, setDescription] = useState(form?.description ?? "");
  const [listId, setListId] = useState(form ? String(form.listId) : "");
  const [fields, setFields] = useState<Field[]>(form?.fields ?? [
    { id: "q1", label: "Title", type: "text", required: true, maps: "name" },
    { id: "q2", label: "Details", type: "textarea", required: false, maps: "description" },
    { id: "q3", label: "Your email", type: "email", required: true, maps: null },
  ]);
  const { data: tree } = useQuery({ queryKey: ["work", "tree", ws], queryFn: () => workApi.tree(ws) });
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  const set = (i: number, patch: Partial<Field>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => setFields((fs) => { const n = [...fs]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); return n; });
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), description: description.trim() || null, listId: Number(listId), fields };
      return form ? (await api.patch(`/work/forms/${form.id}`, body)).data : (await api.post(`/work/workspaces/${ws}/forms`, body)).data;
    },
    onSuccess: () => { toast.success(form ? "Form saved" : "Form created — copy its link to share"); onSaved(); onClose(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't save the form.")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
        <DialogTitle>{form ? "Edit form" : "New form"}</DialogTitle>
        <DialogDescription>Each answer becomes a task. Link a question to the task&apos;s name, description, due date or priority.</DialogDescription>
        <input aria-label="Form name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] font-medium" />
        <textarea aria-label="Form description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this form for? (shown at the top)" className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px]" />
        <label className="text-[12px] text-muted-foreground">Answers go to list
          <select aria-label="Target list" value={listId} onChange={(e) => setListId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
            <option value="">Pick a list…</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <ol aria-label="Questions" className="space-y-2">
          {fields.map((f, i) => (
            <li key={f.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <input aria-label={`Question ${i + 1}`} value={f.label} onChange={(e) => set(i, { label: e.target.value })} className="h-8 min-w-[180px] flex-1 rounded-md border border-border bg-background px-2 text-[13px]" />
                <select aria-label={`Question ${i + 1} type`} value={f.type} onChange={(e) => set(i, { type: e.target.value as Field["type"], ...(e.target.value === "select" && !f.options?.length ? { options: ["Option 1"] } : {}) })} className="h-8 rounded-md border border-border bg-background px-1.5 text-[12.5px]">{(Object.keys(TYPE_LABEL) as Field["type"][]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
                <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} /> Required</label>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-accent disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-accent disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={`Remove question ${i + 1}`} disabled={fields.length === 1} onClick={() => setFields(fields.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-5 text-[12px] text-muted-foreground">
                Fills the task&apos;s
                <select aria-label={`Question ${i + 1} fills`} value={f.maps ?? ""} onChange={(e) => set(i, { maps: (e.target.value || null) as Field["maps"] })} className="h-7 rounded-md border border-border bg-background px-1.5 text-[12px] text-foreground">{Object.entries(MAP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                {f.type === "select" && <input aria-label={`Question ${i + 1} choices`} value={(f.options ?? []).join(", ")} onChange={(e) => set(i, { options: e.target.value.split(",").map((x) => x.trim()) })} placeholder="Choices, separated by commas" className="h-7 min-w-[220px] flex-1 rounded-md border border-border bg-background px-2 text-foreground" />}
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setFields([...fields, { id: `q${Date.now().toString(36)}`, label: "New question", type: "text", required: false, maps: null }])} className="flex items-center gap-1 self-start text-[13px] font-medium text-primary hover:underline"><Plus className="h-4 w-4" /> Add question</button>
        <div className="flex justify-end"><button type="button" disabled={!name.trim() || !listId || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">{form ? "Save form" : "Create form"}</button></div>
      </DialogContent>
    </Dialog>
  );
}
