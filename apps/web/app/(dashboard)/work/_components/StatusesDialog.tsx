"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workApi, type StatusCategory, type WorkListDetail, type WorkStatus } from "@/services/work.api";

const CATEGORIES: { value: StatusCategory; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "ACTIVE", label: "Active" },
  { value: "DONE", label: "Done" },
];

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";

/** Edit the statuses a list uses: rename, recolour, category ("Done" closes tasks), delete, add. */
export function StatusesDialog({
  open,
  onOpenChange,
  list,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  list: WorkListDetail;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const save = async (s: WorkStatus, body: Parameters<typeof workApi.updateStatus>[1]) => {
    try {
      await workApi.updateStatus(s.id, body);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const remove = async (s: WorkStatus) => {
    if (!confirm(`Delete "${s.name}"? Tasks in it move to another status in the same category.`)) return;
    try {
      await workApi.deleteStatus(s.id);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const add = async () => {
    const n = newName.trim();
    if (!n) return;
    try {
      await workApi.createStatus(list.spaceId, { name: n, color: "#2563EB", category: "ACTIVE" });
      setNewName("");
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[24px] font-normal">Edit statuses</DialogTitle>
          <DialogDescription>
            Statuses belong to {list.space.name}. A status in the <b>Done</b> category marks its tasks complete.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5">
          {list.statuses.map((s) => (
            <li key={`${s.id}:${s.name}:${s.color}:${s.category}`} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Colour of ${s.name}`}
                defaultValue={s.color}
                onBlur={(e) => e.target.value.toLowerCase() !== s.color.toLowerCase() && save(s, { color: e.target.value })}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <Input
                aria-label={`Name of ${s.name}`}
                defaultValue={s.name}
                maxLength={60}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) save(s, { name: v });
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="h-8"
              />
              <select
                aria-label={`Category of ${s.name}`}
                value={s.category}
                onChange={(e) => save(s, { category: e.target.value as StatusCategory })}
                className="h-8 rounded-md border border-border bg-background px-2 text-[13px]"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button type="button" aria-label={`Delete ${s.name}`} onClick={() => remove(s)} disabled={list.statuses.length <= 1} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New status name" aria-label="New status name" maxLength={60} className="h-8" />
          <Button type="submit" size="sm" disabled={!newName.trim()}>Add</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
