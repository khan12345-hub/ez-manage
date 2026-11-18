"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ClipboardList, Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { workApi, workKeys } from "@/services/work.api";
import { FormEditor, linkOf, type FormRow } from "../../_components/FormEditor";

const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;

/** Work → Forms: share a link; every answer becomes a task in the list you pick. */
export default function FormsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { data: accessTree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws, staleTime: 30_000 });
  const canCreate = !!accessTree?.access.canEdit;
  const qc = useQueryClient();
  const key = ["work", "forms", ws];
  const { data: forms = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<FormRow[]>(`/work/workspaces/${ws}/forms`)).data });
  const [editing, setEditing] = useState<FormRow | "new" | null>(null);
  // "+ Create → Form" and the list "+ View → Form" open a new form (?new=1&list=<id>)
  const sp = useSearchParams();
  const router = useRouter();
  const [startList, setStartList] = useState("");
  useEffect(() => {
    const id = Number(sp.get("edit"));
    if (!id || !forms.length) return;
    const f = forms.find((x) => x.id === id);
    if (f) { setEditing(f); router.replace(`/work/${ws}/forms`); }
  }, [sp, forms, router, ws]);
  useEffect(() => {
    if (sp.get("new") !== "1") return;
    setStartList(sp.get("list") ?? "");
    setEditing("new");
    router.replace(`/work/${ws}/forms`);
  }, [sp, router, ws]);
  const toggle = useMutation({ mutationFn: (f: FormRow) => api.patch(`/work/forms/${f.id}`, { active: !f.active }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const del = useMutation({ mutationFn: (f: FormRow) => api.delete(`/work/forms/${f.id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Form deleted"); } });

  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6">
      <PageHeader icon={ClipboardList} title="Forms" subtitle="Share a link — every answer becomes a task in the list you choose." actions={<>
        {canCreate && <button type="button" onClick={() => setEditing("new")} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New form</button>}
      </>} />
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
      {editing && <FormEditor ws={ws} form={editing === "new" ? null : editing} startList={startList} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: key })} />}
    </div>
  );
}
