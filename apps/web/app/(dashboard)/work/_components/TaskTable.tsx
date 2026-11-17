"use client";

/* The one task table used outside a list (space / folder List, DM Tasks, My Tasks): same look as a list's List view. */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkUser } from "@/services/work.api";
import { Avatar, PriorityFlag } from "./primitives";

export type TaskTableRow = {
  id: number; uid: string; name: string; completedAt: string | null; dueDate: string | null; priority: string | null;
  assignees: WorkUser[]; status?: { name: string; color: string } | null; where?: { label: string; href?: string; color?: string };
};
export type TaskTableGroup = { name: string; color: string; items: TaskTableRow[] };

function Due({ t }: { t: TaskTableRow }) {
  if (!t.dueDate) return <span className="text-muted-foreground">—</span>;
  const d = new Date(t.dueDate);
  const late = !t.completedAt && d < new Date(new Date().setHours(0, 0, 0, 0));
  return <span className={late ? "font-semibold text-destructive" : "text-muted-foreground"}>{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>;
}

export function TaskTable({ groups, onOpen, whereLabel = "Location", empty = "No tasks here yet." }: { groups: TaskTableGroup[]; onOpen: (uid: string) => void; whereLabel?: string; empty?: React.ReactNode }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const shown = groups.filter((g) => g.items.length);
  if (!shown.length) return <div className="rounded-xl border border-dashed border-border bg-card/60 py-12 text-center text-[13px] text-muted-foreground">{empty}</div>;
  return (
    <div className="space-y-4">
      {shown.map((g) => {
        const isOpen = !closed[g.name];
        return (
          <section key={g.name} aria-label={g.name} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04)]" style={{ borderTopColor: g.color, borderTopWidth: 3 }}>
            <header className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" aria-label={isOpen ? `Collapse ${g.name}` : `Expand ${g.name}`} aria-expanded={isOpen} onClick={() => setClosed({ ...closed, [g.name]: isOpen })} className="rounded p-0.5 text-muted-foreground hover:bg-muted">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
              <span className="rounded-md px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-white" style={{ background: g.color }}>{g.name}</span>
              <span className="text-[12px] text-muted-foreground">{g.items.length}</span>
            </header>
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-[13.5px]">
                  <thead>
                    <tr className="border-y border-border bg-muted/30 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-2 pl-10 pr-3 font-semibold">Name</th>
                      <th className="w-[210px] px-3 py-2 font-semibold">{whereLabel}</th>
                      <th className="w-[120px] px-3 py-2 font-semibold">Assignee</th>
                      <th className="w-[100px] px-3 py-2 font-semibold">Due date</th>
                      <th className="w-[110px] px-3 py-2 font-semibold">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((t) => {
                      const dot = t.status?.color ?? g.color;
                      return (
                        <tr key={t.id} onClick={() => onOpen(t.uid)} className="cursor-pointer border-b border-border/70 last:border-b-0 hover:bg-muted/40">
                          <td className="py-2.5 pl-4 pr-3">
                            <span className="flex items-center gap-3">
                              <span className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: dot, background: t.completedAt ? dot : "transparent" }} title={t.status?.name} />
                              <span className={cn("truncate font-medium", t.completedAt && "text-muted-foreground line-through")}>{t.name}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {t.where ? (
                              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                                {t.where.color && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: t.where.color }} />}
                                {t.where.href ? <Link href={t.where.href} onClick={(e) => e.stopPropagation()} className="truncate hover:text-primary hover:underline">{t.where.label}</Link> : <span className="truncate">{t.where.label}</span>}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5"><span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <Avatar key={a.id} user={a} size={24} />)}{!t.assignees.length && <span className="text-muted-foreground">—</span>}</span></td>
                          <td className="px-3 py-2.5 text-[12.5px]"><Due t={t} /></td>
                          <td className="px-3 py-2.5">{t.priority && t.priority !== "NONE" ? <PriorityFlag priority={t.priority as any} showLabel /> : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
