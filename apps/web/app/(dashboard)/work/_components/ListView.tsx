"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  CornerDownRight,
  EyeOff,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMinutes, workApi, workKeys, type WorkListDetail, type WorkTask } from "@/services/work.api";
import { DueLabel, PriorityFlag, StatusGlyph, dueText } from "./primitives";
import { AssigneeCell, AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { useCreateTask, useUpdateTask } from "./hooks";
import { cfId, colMeta, groupTasks, isCf, sortTasks, type Col, type SortKey, type TaskGroup, type ViewSettings } from "./viewSettings";
import { FieldEditor } from "./CustomFields";
import { BulkBar, CalcRow } from "./ListExtras";
import { CheckSquare } from "lucide-react";
import type { FieldValues, WorkField } from "@/services/work.api";
import { NameDialog } from "./NameDialog";
import { StatusesDialog } from "./StatusesDialog";

const gridFor = (cols: Col[], fields: WorkField[]) => ({
  gridTemplateColumns: `minmax(240px,1fr) ${cols.map((c) => `${colMeta(c, fields).width}px`).join(" ")}`,
});

/** ClickUp-style List view: grouped cards, configurable columns, editable rows. */
export function ListView({
  list,
  tasks,
  view,
  onView,
  onOpenTask,
  fields = [],
  fieldValues = {},
  onFieldChange,
}: {
  list: WorkListDetail;
  tasks: WorkTask[];
  view: ViewSettings;
  onView: (v: ViewSettings) => void;
  onOpenTask: (uid: string) => void;
  fields?: WorkField[];
  fieldValues?: FieldValues;
  onFieldChange?: (taskId: number, fieldId: number, value: unknown) => void;
}) {
  // drop columns of deleted custom fields
  const columns = view.columns.filter((c) => !isCf(c) || fields.some((f) => f.id === cfId(c)));
  const canEdit = list.access.canEdit;
  const canManage = list.access.canManage;
  const update = useUpdateTask(list.id, list.statuses);
  const qc = useQueryClient();
  const roots = sortTasks(tasks.filter((t) => !t.parentId), view.sort);
  const childrenOf = useMemo(() => {
    const m = new Map<number, WorkTask[]>();
    for (const t of sortTasks(tasks, view.sort)) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
    return m;
  }, [tasks, view.sort]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [renaming, setRenaming] = useState<TaskGroup | null>(null);
  const [newStatus, setNewStatus] = useState(false);
  const [editStatuses, setEditStatuses] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const toggleSelect = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const groups = groupTasks(roots, view, list).filter((g) => !view.hiddenGroups.includes(g.key));
  const ctx: RowCtx = {
    list,
    canEdit,
    columns,
    fields,
    fieldValues,
    onFieldChange,
    childrenOf,
    expanded: (id) => (view.subtasks === "expanded" ? expanded[id] !== false : !!expanded[id]),
    setExpanded: (id, open) => setExpanded((e) => ({ ...e, [id]: open })),
    update,
    onOpenTask,
    selected,
    toggleSelect,
  };
  const refreshList = () => {
    qc.invalidateQueries({ queryKey: workKeys.list(list.uid) });
    qc.invalidateQueries({ queryKey: workKeys.tasks(list.id) });
  };

  const sortBy = (key: SortKey) => {
    const cur = view.sort;
    onView({ ...view, sort: !cur || cur.key !== key ? { key, dir: "asc" } : cur.dir === "asc" ? { key, dir: "desc" } : null });
  };

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section
          key={g.key}
          aria-label={g.label}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_8px_24px_-16px_rgb(11_42_31/0.18)]"
          style={{ borderTopColor: g.color, borderTopWidth: 3 }}
        >
          <header className="flex items-center gap-2 bg-table-head px-3 py-2">
            <button type="button" aria-label={collapsed[g.key] ? `Expand ${g.label}` : `Collapse ${g.label}`} onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))} aria-expanded={!collapsed[g.key]} className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground">
              {collapsed[g.key] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-sm" style={{ background: g.color }}>
              {g.status && <StatusGlyph status={{ ...g.status, color: "#ffffff" }} size={11} />}
              {g.label}
            </span>
            <span className="font-mono text-[12px] text-muted-foreground">{g.tasks.length}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`${g.label} group options`} className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Group options</DropdownMenuLabel>
                {g.status && canManage && (
                  <>
                    <DropdownMenuItem onClick={() => setRenaming(g)}><Pencil className="mr-2 h-3.5 w-3.5" />Rename</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNewStatus(true)}><Plus className="mr-2 h-3.5 w-3.5" />New status</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditStatuses(true)}><Settings2 className="mr-2 h-3.5 w-3.5" />Edit statuses</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canEdit && <DropdownMenuItem onClick={() => setSelected((s) => [...new Set([...s, ...g.tasks.map((t) => t.id)])])}><CheckSquare className="mr-2 h-3.5 w-3.5" />Select all</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setCollapsed((c) => ({ ...c, [g.key]: true }))}><ChevronRight className="mr-2 h-3.5 w-3.5" />Collapse group</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onView({ ...view, hiddenGroups: [...view.hiddenGroups, g.key] })}><EyeOff className="mr-2 h-3.5 w-3.5" />Hide group</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCollapsed(Object.fromEntries(groups.map((x) => [x.key, true])))}><ChevronsDownUp className="mr-2 h-3.5 w-3.5" />Collapse all groups</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {g.status && canManage && (
              <button type="button" aria-label="New status" title="New status" onClick={() => setNewStatus(true)} className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </header>

          {!collapsed[g.key] && (
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="grid items-center border-t border-border bg-table-head px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground" style={gridFor(columns, fields)}>
                  <SortHeader label="Name" k="name" view={view} onSort={sortBy} className="pl-[26px]" />
                  {columns.map((c) => {
                    const m = colMeta(c, fields);
                    return m.sort ? <SortHeader key={c} label={m.label} k={m.sort} view={view} onSort={sortBy} /> : <span key={c} className="truncate">{m.label}</span>;
                  })}
                </div>
                {g.tasks.map((t) => <Row key={t.id} task={t} ctx={ctx} />)}
                {canEdit && <AddTaskRow listId={list.id} defaults={g.createDefaults} />}
                {g.tasks.length > 0 && (
                  <CalcRow
                    columns={columns}
                    fields={fields}
                    values={fieldValues}
                    tasks={g.tasks}
                    calcs={view.calcs ?? {}}
                    onCalc={(c, calc) => onView({ ...view, calcs: { ...(view.calcs ?? {}), [c]: calc } })}
                    grid={gridFor(columns, fields)}
                  />
                )}
                {!canEdit && g.tasks.length === 0 && <p className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">No tasks</p>}
              </div>
            </div>
          )}
        </section>
      ))}

      {view.hiddenGroups.length > 0 && (
        <button type="button" onClick={() => onView({ ...view, hiddenGroups: [] })} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
          Show {view.hiddenGroups.length} hidden {view.hiddenGroups.length === 1 ? "group" : "groups"}
        </button>
      )}

      <NameDialog
        open={!!renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename status"
        initial={{ name: renaming?.status?.name ?? "" }}
        submitLabel="Save"
        onSubmit={async (r) => {
          await workApi.updateStatus(renaming!.status!.id, { name: r.name });
          refreshList();
        }}
      />
      <NameDialog
        open={newStatus}
        onOpenChange={setNewStatus}
        title="New status"
        description={`Added to ${list.space.name}. Every list in this space uses it.`}
        placeholder="e.g. Needs review"
        withColor
        onSubmit={async (r) => {
          await workApi.createStatus(list.spaceId, { name: r.name, color: r.color ?? "#2563EB", category: "ACTIVE" });
          refreshList();
          toast.success("Status added");
        }}
      />
      <StatusesDialog open={editStatuses} onOpenChange={setEditStatuses} list={list} onChanged={refreshList} />
      {canEdit && <BulkBar list={list} selected={selected.filter((id) => tasks.some((t) => t.id === id))} onClear={() => setSelected([])} />}
    </div>
  );
}

function SortHeader({ label, k, view, onSort, className }: { label: string; k: SortKey; view: ViewSettings; onSort: (k: SortKey) => void; className?: string }) {
  const active = view.sort?.key === k;
  return (
    <button type="button" aria-label={`Sort by ${label}`} onClick={() => onSort(k)} className={cn("flex items-center gap-1 text-left uppercase hover:text-foreground", active && "text-foreground", className)}>
      {label}
      {active && (view.sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

type RowCtx = {
  list: WorkListDetail;
  canEdit: boolean;
  columns: Col[];
  fields: WorkField[];
  fieldValues: FieldValues;
  onFieldChange?: (taskId: number, fieldId: number, value: unknown) => void;
  childrenOf: Map<number, WorkTask[]>;
  expanded: (id: number) => boolean;
  setExpanded: (id: number, open: boolean) => void;
  update: ReturnType<typeof useUpdateTask>;
  onOpenTask: (uid: string) => void;
  selected: number[];
  toggleSelect: (id: number) => void;
};

function Row({ task, depth = 0, ctx }: { task: WorkTask; depth?: number; ctx: RowCtx }) {
  const { list, canEdit, columns, childrenOf, update, onOpenTask } = ctx;
  const status = list.statuses.find((s) => s.id === task.statusId);
  const kids = childrenOf.get(task.id) ?? [];
  const isOpen = kids.length > 0 && ctx.expanded(task.id);
  const cell = (c: Col) => {
    if (isCf(c)) {
      const f = ctx.fields.find((x) => x.id === cfId(c))!;
      return (
        <div key={c} className="min-w-0 pr-2" onClick={(e) => e.stopPropagation()}>
          <FieldEditor compact field={f} value={ctx.fieldValues[task.id]?.[f.id]} members={list.members} disabled={!canEdit || !ctx.onFieldChange} onChange={(v) => ctx.onFieldChange?.(task.id, f.id, v)} />
        </div>
      );
    }
    switch (c) {
      case "assignee":
        return (
          <div key={c}>
            <AssigneePicker members={list.members} value={task.assignees} disabled={!canEdit} onChange={(ids) => update.mutate({ id: task.id, body: { assigneeIds: ids } })}>
              <button type="button" aria-label="Assignees" className="rounded-md p-0.5 hover:bg-card"><AssigneeCell users={task.assignees} editable={canEdit} /></button>
            </AssigneePicker>
          </div>
        );
      case "due":
        return (
          <div key={c}>
            <DatePicker label="Due date" value={task.dueDate} disabled={!canEdit} onChange={(iso) => update.mutate({ id: task.id, body: { dueDate: iso } })}>
              <button type="button" aria-label="Due date" className="rounded-md px-1 py-0.5 hover:bg-card"><DueLabel task={task} /></button>
            </DatePicker>
          </div>
        );
      case "priority":
        return (
          <div key={c}>
            <PriorityPicker value={task.priority} disabled={!canEdit} onChange={(p) => update.mutate({ id: task.id, body: { priority: p } })}>
              <button type="button" aria-label="Priority" className="rounded-md px-1 py-0.5 hover:bg-card"><PriorityFlag priority={task.priority} showLabel={!!task.priority} /></button>
            </PriorityPicker>
          </div>
        );
      case "start":
        return (
          <div key={c}>
            <DatePicker label="Start date" value={task.startDate} disabled={!canEdit} onChange={(iso) => update.mutate({ id: task.id, body: { startDate: iso } })}>
              <button type="button" aria-label="Start date" className="rounded-md px-1 py-0.5 text-[12.5px] text-muted-foreground hover:bg-card">{task.startDate ? dueText(task.startDate) : "—"}</button>
            </DatePicker>
          </div>
        );
      case "estimate":
        return <span key={c} className="font-mono text-[12.5px] text-muted-foreground">{task.timeEstimate ? formatMinutes(task.timeEstimate) : "—"}</span>;
      case "tags":
        return (
          <span key={c} className="flex min-w-0 flex-wrap gap-1">
            {task.tags?.length ? (
              task.tags.slice(0, 3).map((t) => (
                <span key={t.id} className="truncate rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
              ))
            ) : (
              <span className="text-[12.5px] text-muted-foreground/50">—</span>
            )}
          </span>
        );
      case "created":
        return <span key={c} className="text-[12.5px] text-muted-foreground">{dueText(task.createdAt)}</span>;
    }
  };
  return (
    <>
      <div className="group grid min-h-[42px] items-center border-t border-border/70 px-3 transition-colors hover:bg-accent/30" style={gridFor(columns, ctx.fields)}>
        <div className="relative flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 22 }}>
          {canEdit && (
            <input
              type="checkbox"
              aria-label={`Select ${task.name}`}
              checked={ctx.selected.includes(task.id)}
              onChange={() => ctx.toggleSelect(task.id)}
              className={cn(
                "absolute -left-[13px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 cursor-pointer accent-[var(--primary)] transition-opacity",
                ctx.selected.length ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
              )}
            />
          )}
          {kids.length > 0 ? (
            <button type="button" aria-label={isOpen ? "Hide subtasks" : "Show subtasks"} onClick={() => ctx.setExpanded(task.id, !isOpen)} className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground">
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0">{depth > 0 && <CornerDownRight className="h-3 w-3 text-muted-foreground/50" />}</span>
          )}
          <StatusPicker statuses={list.statuses} value={task.statusId} disabled={!canEdit} onChange={(id) => update.mutate({ id: task.id, body: { statusId: id } })}>
            <button type="button" aria-label={`Status: ${status?.name ?? "none"}`} className="shrink-0 rounded-full p-0.5 transition-transform hover:scale-110 disabled:cursor-default">
              <StatusGlyph status={status} size={15} />
            </button>
          </StatusPicker>
          <button type="button" onClick={() => onOpenTask(task.uid)} className={cn("min-w-0 truncate text-left text-[14px] font-medium text-foreground hover:text-primary", task.completedAt && "text-muted-foreground line-through decoration-muted-foreground/40")}>
            {task.name}
          </button>
          {!columns.includes("tags") &&
            task.tags?.slice(0, 2).map((t) => (
              <span key={t.id} className="hidden shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold sm:inline" style={{ background: `${t.color}1f`, color: t.color }}>{t.name}</span>
            ))}
          {task.subtaskCount > 0 && (
            <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-[10.5px] text-muted-foreground" title={`${task.subtaskCount} subtasks`}>{task.subtaskCount}</span>
          )}
          {task.commentCount > 0 && (
            <span className="hidden shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground sm:inline-flex" title={`${task.commentCount} comments`}>
              <MessageSquare className="h-3 w-3" /> {task.commentCount}
            </span>
          )}
        </div>
        {columns.map(cell)}
      </div>
      {isOpen && kids.map((k) => <Row key={k.id} task={k} depth={depth + 1} ctx={ctx} />)}
    </>
  );
}

function AddTaskRow({ listId, defaults }: { listId: number; defaults: TaskGroup["createDefaults"] }) {
  const create = useCreateTask(listId);
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const submit = () => {
    const n = name.trim();
    if (!n) {
      setActive(false);
      return;
    }
    create.mutate({ name: n, ...defaults }, { onSuccess: () => setName("") });
  };
  return active ? (
    <div className="flex items-center gap-2 border-t border-border/70 px-3 py-1.5 pl-[42px]">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setName("");
            setActive(false);
          }
        }}
        onBlur={submit}
        placeholder="Task name, then Enter"
        aria-label="New task name"
        className="h-8 flex-1 rounded-md border border-primary/40 bg-background px-2.5 text-[14px] outline-none focus:ring-2 focus:ring-primary/20"
      />
      <span className="hidden font-mono text-[10.5px] text-muted-foreground sm:inline">Enter ↵</span>
    </div>
  ) : (
    <button type="button" onClick={() => setActive(true)} className="flex w-full items-center gap-2 border-t border-border/70 px-3 py-2 pl-[42px] text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground">
      <Plus className="h-3.5 w-3.5" /> Add task
    </button>
  );
}
