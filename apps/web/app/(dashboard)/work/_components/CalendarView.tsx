"use client";

import { useState } from "react";
import { type WorkListDetail, type WorkTask } from "@/services/work.api";
import { StatusGlyph } from "./primitives";
import { CalendarGrid } from "./CalendarGrid";


/** Month calendar of tasks by due date. */
export function CalendarView({ list, tasks, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const statusOf = (t: WorkTask) => list.statuses.find((s) => s.id === t.statusId);

  const undated = tasks.filter((t) => !t.dueDate && !t.parentId);
  return (
    <CalendarGrid
      month={cursor}
      onMonth={setCursor}
      items={tasks.map((t) => ({ id: t.id, uid: t.uid, name: t.name, dueDate: t.dueDate, completedAt: t.completedAt, color: statusOf(t)?.color }))}
      onOpen={onOpenTask}
      aside={
      <aside className="h-fit rounded-2xl border border-border bg-card p-4">
        <h3 className="text-[15px] font-semibold">No due date</h3>
        <p className="mt-1 text-xs text-muted-foreground">{undated.length} {undated.length === 1 ? "task" : "tasks"}</p>
        <ul className="mt-3 space-y-1">
          {undated.slice(0, 30).map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpenTask(t.uid)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <StatusGlyph status={statusOf(t)} size={12} />
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      }
    />
  );
}
