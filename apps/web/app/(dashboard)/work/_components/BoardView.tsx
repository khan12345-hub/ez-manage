"use client";

import { useMemo, useState } from "react";
import { CalendarDays, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_META, userName, workApi, type FieldValues, type WorkField, type WorkListDetail, type WorkPriority, type WorkTask } from "@/services/work.api";
import { AvatarStack, DueLabel, PriorityFlag, StatusGlyph, onColor } from "./primitives";
import { useCreateTask, useUpdateTask } from "./hooks";
import { FIELD_META, FieldDisplay } from "./CustomFields";

/** what a board can be grouped by: status, assignee, priority, or a dropdown / labels custom field ("cf:<id>") */
export type BoardGroup = "status" | "assignee" | "priority" | `cf:${number}`;
export function boardGroupOptions(fields: WorkField[]) {
  return [
    { value: "status", label: "Status" },
    { value: "assignee", label: "Assignee" },
    { value: "priority", label: "Priority" },
    ...fields.filter((f) => f.type === "dropdown" || f.type === "labels").map((f) => ({ value: `cf:${f.id}`, label: f.name })),
  ] as { value: BoardGroup; label: string }[];
}

type Col = {
  key: string;
  label: string;
  color: string;
  glyph?: React.ReactNode;
  has: (t: WorkTask) => boolean;
  /** dropping a card here */
  drop?: (t: WorkTask) => void;
  /** what a card added in this column starts with */
  create?: { statusId?: number; priority?: WorkPriority; assigneeIds?: number[]; field?: { id: number; value: unknown } };
};

/** Kanban: columns by status (default), assignee, priority or a custom field; drag a card to change that value. */
export function BoardView({
  list, tasks, onOpenTask, groupBy = "status", fields = [], fieldValues = {}, onFieldChange,
}: {
  list: WorkListDetail;
  tasks: WorkTask[];
  onOpenTask: (uid: string) => void;
  groupBy?: BoardGroup;
  fields?: WorkField[];
  fieldValues?: FieldValues;
  onFieldChange?: (taskId: number, fieldId: number, value: unknown) => void;
}) {
  const canEdit = list.access.canEdit;
  const update = useUpdateTask(list.id, list.statuses);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const roots = tasks.filter((t) => !t.parentId);
  const valueOf = (t: WorkTask, fieldId: number) => fieldValues[t.id]?.[fieldId];
  const groupField = groupBy.startsWith("cf:") ? fields.find((f) => f.id === Number(groupBy.slice(3))) : undefined;

  const columns = useMemo<Col[]>(() => {
    if (groupBy === "priority") {
      const ps: (WorkPriority | null)[] = ["URGENT", "HIGH", "NORMAL", "LOW", null];
      return ps.map((p) => ({
        key: p ?? "none",
        label: p ? PRIORITY_META[p].label : "No priority",
        color: p ? PRIORITY_META[p].color : "#9CA3AF",
        glyph: <PriorityFlag priority={p} />,
        has: (t) => (t.priority ?? null) === p,
        drop: (t) => update.mutate({ id: t.id, body: { priority: p } }),
        create: p ? { priority: p } : {},
      }));
    }
    if (groupBy === "assignee") {
      const people = new Map<number, WorkTask["assignees"][number]>();
      for (const m of list.members ?? []) people.set(m.id, m);
      for (const t of roots) for (const a of t.assignees) people.set(a.id, a);
      const used = [...people.values()].filter((u) => roots.some((t) => t.assignees.some((a) => a.id === u.id)));
      return [
        ...used.map((u) => ({
          key: `u${u.id}`, label: userName(u), color: "#475569",
          glyph: <AvatarStack users={[u]} size={18} />,
          has: (t: WorkTask) => t.assignees.some((a) => a.id === u.id),
          drop: (t: WorkTask) => update.mutate({ id: t.id, body: { assigneeIds: [u.id] } }),
          create: { assigneeIds: [u.id] },
        })),
        { key: "none", label: "Unassigned", color: "#9CA3AF", has: (t: WorkTask) => !t.assignees.length, drop: (t: WorkTask) => update.mutate({ id: t.id, body: { assigneeIds: [] } }), create: {} },
      ];
    }
    if (groupField) {
      const opts = groupField.config?.options ?? [];
      const multi = groupField.type === "labels";
      return [
        ...opts.map((o) => ({
          key: o.id, label: o.name, color: o.color,
          has: (t: WorkTask) => { const v = valueOf(t, groupField.id); return multi ? Array.isArray(v) && v.includes(o.id) : v === o.id; },
          drop: (t: WorkTask) => onFieldChange?.(t.id, groupField.id, multi ? [o.id] : o.id),
          create: { field: { id: groupField.id, value: multi ? [o.id] : o.id } },
        })),
        {
          key: "none", label: `No ${groupField.name}`, color: "#9CA3AF",
          has: (t: WorkTask) => { const v = valueOf(t, groupField.id); return v === undefined || v === null || (Array.isArray(v) && !v.length); },
          drop: (t: WorkTask) => onFieldChange?.(t.id, groupField.id, null),
          create: {},
        },
      ];
    }
    return list.statuses.map((s) => ({
      key: `s${s.id}`, label: s.name, color: s.color,
      glyph: <StatusGlyph status={s} size={13} />,
      has: (t: WorkTask) => t.statusId === s.id,
      drop: (t: WorkTask) => { if (t.statusId !== s.id) update.mutate({ id: t.id, body: { statusId: s.id } }); },
      create: { statusId: s.id },
    }));
  }, [groupBy, groupField, list, roots, fieldValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // the space's fields a card shows (set values only, never the one the board is grouped by)
  const cardFields = fields.filter((f) => f.id !== groupField?.id);

  return (
    <div className="flex gap-4 overflow-x-auto pb-6">
      {columns.map((col) => {
        const colTasks = roots.filter(col.has);
        return (
          <section
            key={col.key}
            aria-label={col.label}
            onDragOver={(e) => {
              if (!canEdit || dragId == null || !col.drop) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const t = roots.find((x) => x.id === dragId);
              setDragId(null);
              if (t && !col.has(t)) col.drop?.(t);
            }}
            className={cn(
              "flex min-w-[236px] max-w-[340px] shrink-0 grow basis-[236px] flex-col rounded-xl border bg-table-head transition-colors",
              overCol === col.key ? "border-primary/60 ring-2 ring-primary/15" : "border-border",
            )}
            style={{ borderTopColor: col.color, borderTopWidth: 3 }}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              {col.glyph ?? <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />}
              <span className="truncate text-[12.5px] font-bold uppercase tracking-[0.05em]" style={{ color: col.color }}>{col.label}</span>
              <span className="ml-auto font-mono text-[12px] text-muted-foreground">{colTasks.length}</span>
            </header>
            <div className="flex max-h-[calc(100vh-300px)] min-h-[60px] flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
              {colTasks.map((t) => {
                const st = list.statuses.find((s) => s.id === t.statusId);
                const shownFields = cardFields.filter((f) => { const v = valueOf(t, f.id); return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length); }).slice(0, 4);
                return (
                  <article
                    key={t.id}
                    draggable={canEdit}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
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
                    {groupBy !== "status" && st && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.04em]" style={{ background: st.color, color: onColor(st.color) }}>{st.name}</span>
                    )}
                    <p className={cn("text-[13.5px] font-medium leading-snug text-foreground", t.completedAt && "text-muted-foreground line-through decoration-muted-foreground/40")}>{t.name}</p>
                    {shownFields.length > 0 && (
                      <dl className="mt-2 space-y-1">
                        {shownFields.map((f) => {
                          const Icon = FIELD_META[f.type]?.icon;
                          return (
                            <div key={f.id} className="flex min-w-0 items-center gap-1.5 text-[12px]" title={f.name}>
                              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                              <dd className="flex min-w-0 flex-1 items-center truncate"><FieldDisplay field={f} value={valueOf(t, f.id)} members={list.members} /></dd>
                            </div>
                          );
                        })}
                      </dl>
                    )}
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
                        {t.priority && groupBy !== "priority" && <PriorityFlag priority={t.priority} />}
                      </span>
                    </div>
                  </article>
                );
              })}
              {colTasks.length === 0 && (
                <div className="flex h-14 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                  {dragId != null && canEdit ? "Drop here" : "No tasks"}
                </div>
              )}
              {canEdit && col.create && <AddCard listId={list.id} seed={col.create} onFieldChange={onFieldChange} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AddCard({ listId, seed, onFieldChange }: { listId: number; seed: NonNullable<Col["create"]>; onFieldChange?: (taskId: number, fieldId: number, value: unknown) => void }) {
  const create = useCreateTask(listId);
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const submit = () => {
    const n = name.trim();
    if (!n) return setActive(false);
    const { field, ...body } = seed;
    create.mutate({ name: n, ...body }, {
      onSuccess: (t) => {
        setName("");
        if (field) {
          if (onFieldChange) onFieldChange(t.id, field.id, field.value);
          else void workApi.setFieldValue(t.id, field.id, field.value).catch(() => null);
        }
      },
    });
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
