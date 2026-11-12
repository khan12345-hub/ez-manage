"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { workApi, type WorkPriority } from "@/services/work.api";
import type { CeoCompany } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

const PRIORITIES: { v: WorkPriority | ""; label: string }[] = [{ v: "", label: "No priority" }, { v: "URGENT", label: "Urgent" }, { v: "HIGH", label: "High" }, { v: "NORMAL", label: "Normal" }, { v: "LOW", label: "Low" }];

/**
 * "Assign task" from CEO Tower: creates the task through Work's own API, so Work's
 * permissions, notifications and automations all apply exactly as if it were made in Work.
 */
export function AssignTaskDialog({ companies, defaultCompany, defaultAssignee, onClose }: { companies: CeoCompany[]; people: unknown[]; defaultCompany: string | null; defaultAssignee?: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState(defaultCompany ?? companies[0]?.key ?? "");
  const co = companies.find((c) => c.key === key);
  const [listId, setListId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<number[]>(defaultAssignee ? [defaultAssignee] : []);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<WorkPriority | "">("HIGH");
  const { data: tree } = useQuery({ queryKey: ["work", "tree", co?.uid], queryFn: () => workApi.tree(co!.uid), enabled: !!co });
  const { data: dir } = useQuery({ queryKey: ["work", "directory", co?.uid], queryFn: () => workApi.directory(co!.uid), enabled: !!co });
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, label: `${s.name} / ${l.name}` })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, label: `${s.name} / ${f.name} / ${l.name}` })))]), [tree]);
  const members = (dir?.people ?? []).filter((p) => p.role !== "GUEST" || assignees.includes(p.user.id));
  // a preselected person who isn't in this company can't be assigned here
  useEffect(() => { if (dir) setAssignees((a) => a.filter((id) => dir.people.some((p) => p.user.id === id))); }, [dir]);
  const create = useMutation({
    mutationFn: () => workApi.createTask(listId!, {
      name: name.trim(), assigneeIds: assignees, ...(description.trim() ? { description: description.trim() } : {}),
      ...(due ? { dueDate: new Date(`${due}T17:00:00`).toISOString() } : {}), ...(priority ? { priority } : {}),
    }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["ceo-tower"] });
      toast.success(`Task assigned: ${t.name}`);
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't create the task."),
  });
  const ready = !!listId && !!name.trim() && assignees.length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle className="font-serif text-[22px] font-normal">Assign a task</DialogTitle>
        <DialogDescription>It is created in Work, in the list you pick, and the people get notified as usual.</DialogDescription>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-medium text-muted-foreground">Company
              <select aria-label="Company" value={key} onChange={(e) => { setKey(e.target.value); setListId(null); setAssignees([]); }} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                {companies.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">List
              <select aria-label="List" value={listId ?? ""} onChange={(e) => setListId(Number(e.target.value) || null)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                <option value="">{tree ? "Choose a list…" : "Loading…"}</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
          </div>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="What needs to happen?" aria-label="Task name" maxLength={500} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" aria-label="Details" rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
          <div>
            <p className="mb-1 text-[12px] font-medium text-muted-foreground">Assign to</p>
            <ul aria-label="Assign to" className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {members.map((p) => {
                const on = assignees.includes(p.user.id);
                return (
                  <li key={p.user.id}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => setAssignees(on ? assignees.filter((x) => x !== p.user.id) : [...assignees, p.user.id])} className={cn("flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[12.5px] ring-1", on ? "bg-primary/10 font-semibold ring-primary/40" : "ring-border hover:bg-accent")}>
                      <Avatar user={p.user} size={20} /> {p.user.firstName} {p.user.lastName}{on && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  </li>
                );
              })}
              {!members.length && <li className="text-[12px] text-muted-foreground">{dir ? "No people in this company yet." : "Loading people…"}</li>}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-medium text-muted-foreground">Due date
              <input type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground" />
            </label>
            <label className="text-[12px] font-medium text-muted-foreground">Priority
              <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as WorkPriority | "")} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13px] text-foreground">
                {PRIORITIES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">{ready ? "" : "Pick a list, a name and at least one person."}</span>
          <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Assign task</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
