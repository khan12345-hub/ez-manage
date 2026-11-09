"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkListDetail, WorkTask } from "@/services/work.api";
import { AvatarStack, DueLabel, PriorityFlag, StatusPill } from "./primitives";

/** Gallery view: one card per task (ClickUp "Gallery"). */
export function GalleryView({ list, tasks, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; onOpenTask: (uid: string) => void }) {
  const roots = tasks.filter((t) => !t.parentId);
  if (!roots.length) return <p className="py-16 text-center text-[13px] text-muted-foreground">No tasks to show.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {roots.map((t) => {
        const status = list.statuses.find((s) => s.id === t.statusId);
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onOpenTask(t.uid)}
              className="group flex h-full w-full flex-col rounded-xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgb(11_42_31/0.04)] transition-shadow hover:shadow-[0_10px_28px_-18px_rgb(11_42_31/0.4)]"
              style={{ borderTopColor: status?.color, borderTopWidth: 3 }}
            >
              <span className="flex items-start justify-between gap-2">
                <span className={cn("line-clamp-2 text-[14.5px] font-semibold group-hover:text-primary", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
                <PriorityFlag priority={t.priority} />
              </span>
              <span className="mt-2"><StatusPill status={status} /></span>
              {!!t.tags?.length && (
                <span className="mt-2 flex flex-wrap gap-1">
                  {t.tags.slice(0, 4).map((g) => (
                    <span key={g.id} className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ background: `${g.color}1f`, color: g.color }}>{g.name}</span>
                  ))}
                </span>
              )}
              <span className="mt-auto flex items-center gap-2 pt-4 text-[12px] text-muted-foreground">
                <AvatarStack users={t.assignees} size={22} />
                <span className="flex-1" />
                {t.commentCount > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.commentCount}</span>}
                {t.subtaskCount > 0 && <span className="rounded bg-muted px-1.5 font-mono text-[10.5px]">{t.subtaskCount} sub</span>}
                {t.dueDate && <DueLabel task={t} className="text-[12px]" />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
