"use client";

import { useState } from "react";
import { CalendarDays, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkListDetail, WorkTask } from "@/services/work.api";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph } from "./primitives";
import { useCreateTask, useUpdateTask } from "./hooks";

/** Kanban: a column per status; drag a card to another column to change its status. */
export function BoardView({ list, tasks, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void }) {
  const canEdit = list.access.canEdit;
  const update = useUpdateTask(list.id, list.statuses);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const roots = tasks.filter((t) => !t.parentId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-6">
      {list.statuses.map((status) => {
        const colTasks = roots.filter((t) => t.statusId === status.id);
        return (
          <section
            key={status.id}
            aria-label={status.name}
            onDragOver={(e) => {
              if (!canEdit || dragId == null) return;
              e.preventDefault();
              setOverCol(status.id);
            }}
            onDragLeave={() => setOverCol((c) => (c === status.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const t = roots.find((x) => x.id === dragId);
              setDragId(null);
              if (t && t.statusId !== status.id) update.mutate({ id: t.id, body: { statusId: status.id } });
            }}
            className={cn(
              "flex w-[290px] shrink-0 flex-col rounded-xl border bg-table-head transition-colors",
              overCol === status.id ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
            )}
            style={{ borderTopColor: status.color, borderTopWidth: 3 }}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <StatusGlyph status={status} size={13} />
              <span className="truncate text-[12.5px] font-bold uppercase tracking-[0.05em]" style={{ color: status.color }}>{status.name}</span>
              <span className="ml-auto font-mono text-[12px] text-muted-foreground">{colTasks.length}</span>
            </header>
            <div className="flex max-h-[calc(100vh-300px)] min-h-[60px] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
              {colTasks.map((t) => (
                <article
                  key={t.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  onClick={() => onOpenTask(t.uid)}
                  onKeyDown={(e) => e.key === "Enter" && onOpenTask(t.uid)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${t.name}`}
                  className={cn(
                    "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgb(11_42_31/0.05)] transition-[box-shadow,border-color,opacity] hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    canEdit && "active:cursor-grabbing",
                    dragId === t.id && "opacity-50",
                  )}
                >
                  <p className={cn("text-[13.5px] font-medium leading-snug text-foreground", t.completedAt && "text-muted-foreground line-through decoration-muted-foreground/40")}>{t.name}</p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <AvatarStack users={t.assignees} size={22} />
                    {t.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <DueLabel task={t} className="text-[12px]" />
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2">
                      {t.commentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><MessageSquare className="h-3 w-3" />{t.commentCount}</span>
                      )}
                      {t.subtaskCount > 0 && <span className="rounded bg-muted px-1.5 font-mono text-[10.5px] text-muted-foreground">{t.subtaskCount}</span>}
                      {t.priority && <PriorityFlag priority={t.priority} />}
                    </span>
                  </div>
                </article>
              ))}
              {colTasks.length === 0 && (
                <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  {dragId != null && canEdit ? "Drop here" : "No tasks"}
                </div>
              )}
              {canEdit && <AddCard listId={list.id} statusId={status.id} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddCard({ listId, statusId }: { listId: number; statusId: number }) {
  const create = useCreateTask(listId);
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const submit = () => {
    const n = name.trim();
    if (!n) return setActive(false);
    create.mutate({ name: n, statusId }, { onSuccess: () => setName("") });
  };
  return active ? (
    <input
      autoFocus
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") setActive(false);
      }}
      onBlur={submit}
      placeholder="Task name, then Enter"
      aria-label="New task name"
      className="h-9 rounded-lg border border-primary/40 bg-card px-2.5 text-[13.5px] outline-none focus:ring-2 focus:ring-primary/20"
    />
  ) : (
    <button type="button" onClick={() => setActive(true)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
      <Plus className="h-3.5 w-3.5" /> Add task
    </button>
  );
}
