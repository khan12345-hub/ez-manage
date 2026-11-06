"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CornerDownRight, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkListDetail, WorkStatus, WorkTask } from "@/services/work.api";
import { DueLabel, PriorityFlag, StatusGlyph } from "./primitives";
import { AssigneeCell, AssigneePicker, DatePicker, PriorityPicker, StatusPicker } from "./pickers";
import { useCreateTask, useUpdateTask } from "./hooks";

const GRID = "grid grid-cols-[minmax(0,1fr)_88px] sm:grid-cols-[minmax(0,1fr)_120px_112px_92px] items-center";

/** ClickUp-style List view: one card per status, rows editable in place. */
export function ListView({
  list,
  tasks,
  onOpenTask,
}: {
  list: WorkListDetail;
  tasks: WorkTask[];
  onOpenTask: (uid: string) => void;
}) {
  const canEdit = list.access.canEdit;
  const update = useUpdateTask(list.id, list.statuses);
  const roots = tasks.filter((t) => !t.parentId);
  const childrenOf = useMemo(() => {
    const m = new Map<number, WorkTask[]>();
    for (const t of tasks) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
    return m;
  }, [tasks]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const ctx: RowCtx = { list, canEdit, childrenOf, expanded, setExpanded, update, onOpenTask };
  const groups = list.statuses.map((s) => ({ status: s, tasks: roots.filter((t) => t.statusId === s.id) }));
  const noStatus = roots.filter((t) => !t.statusId || !list.statuses.some((s) => s.id === t.statusId));

  return (
    <div className="space-y-4">
      {groups.map(({ status, tasks: groupTasks }) => (
        <StatusGroupCard
          key={status.id}
          status={status}
          count={groupTasks.length}
          collapsed={!!collapsed[status.id]}
          onToggle={() => setCollapsed((c) => ({ ...c, [status.id]: !c[status.id] }))}
        >
          {groupTasks.map((t) => <Row key={t.id} task={t} ctx={ctx} />)}
          {canEdit && <AddTaskRow listId={list.id} statusId={status.id} />}
          {!canEdit && groupTasks.length === 0 && <p className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">No tasks</p>}
        </StatusGroupCard>
      ))}
      {noStatus.length > 0 && (
        <StatusGroupCard status={null} count={noStatus.length} collapsed={false} onToggle={() => {}}>
          {noStatus.map((t) => <Row key={t.id} task={t} ctx={ctx} />)}
        </StatusGroupCard>
      )}
    </div>
  );
}

type RowCtx = {
  list: WorkListDetail;
  canEdit: boolean;
  childrenOf: Map<number, WorkTask[]>;
  expanded: Record<number, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  update: ReturnType<typeof useUpdateTask>;
  onOpenTask: (uid: string) => void;
};

function Row({ task, depth = 0, ctx }: { task: WorkTask; depth?: number; ctx: RowCtx }) {
    const { list, canEdit, childrenOf, expanded, setExpanded, update, onOpenTask } = ctx;
    const status = list.statuses.find((s) => s.id === task.statusId);
    const kids = childrenOf.get(task.id) ?? [];
    const isOpen = !!expanded[task.id];
    return (
      <>
        <div className={cn(GRID, "group min-h-[42px] border-t border-border/70 px-3 transition-colors hover:bg-accent/30")}>
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 22 }}>
            {kids.length > 0 ? (
              <button type="button" aria-label={isOpen ? "Hide subtasks" : "Show subtasks"} onClick={() => setExpanded((e) => ({ ...e, [task.id]: !isOpen }))} className="-ml-1 rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground">
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
            {task.tags?.slice(0, 3).map((t) => (
              <span key={t.id} className="hidden shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold sm:inline" style={{ background: `${t.color}1f`, color: t.color }}>
                {t.name}
              </span>
            ))}
            {task.subtaskCount > 0 && (
              <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-[10.5px] text-muted-foreground" title={`${task.subtaskCount} subtasks`}>
                {task.subtaskCount}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="hidden shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground sm:inline-flex" title={`${task.commentCount} comments`}>
                <MessageSquare className="h-3 w-3" /> {task.commentCount}
              </span>
            )}
          </div>

          <div className="hidden sm:block">
            <AssigneePicker members={list.members} value={task.assignees} disabled={!canEdit} onChange={(ids) => update.mutate({ id: task.id, body: { assigneeIds: ids } })}>
              <button type="button" aria-label="Assignees" className="rounded-md p-0.5 hover:bg-card">
                <AssigneeCell users={task.assignees} editable={canEdit} />
              </button>
            </AssigneePicker>
          </div>

          <div>
            <DatePicker label="Due date" value={task.dueDate} disabled={!canEdit} onChange={(iso) => update.mutate({ id: task.id, body: { dueDate: iso } })}>
              <button type="button" aria-label="Due date" className="rounded-md px-1 py-0.5 hover:bg-card">
                <DueLabel task={task} />
              </button>
            </DatePicker>
          </div>

          <div className="hidden sm:block">
            <PriorityPicker value={task.priority} disabled={!canEdit} onChange={(p) => update.mutate({ id: task.id, body: { priority: p } })}>
              <button type="button" aria-label="Priority" className="rounded-md px-1 py-0.5 hover:bg-card">
                <PriorityFlag priority={task.priority} showLabel={!!task.priority} />
              </button>
            </PriorityPicker>
          </div>
        </div>
        {isOpen && kids.map((k) => <Row key={k.id} task={k} depth={depth + 1} ctx={ctx} />)}
      </>
    );
  }

function StatusGroupCard({
  status,
  count,
  collapsed,
  onToggle,
  children,
}: {
  status: WorkStatus | null;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const color = status?.color ?? "#9CA3AF";
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_8px_24px_-16px_rgb(11_42_31/0.18)]"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
      aria-label={status?.name ?? "No status"}
    >
      <header className="flex items-center gap-2.5 bg-table-head px-3 py-2">
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-sm" style={{ background: color }}>
          <StatusGlyph status={status ? { ...status, color: "#ffffff" } : null} size={11} />
          {status?.name ?? "No status"}
        </span>
        <span className="font-mono text-[12px] text-muted-foreground">{count} {count === 1 ? "task" : "tasks"}</span>
      </header>
      {!collapsed && (
        <>
          <div className={cn(GRID, "border-t border-border bg-table-head px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground")}>
            <span className="pl-[26px]">Name</span>
            <span className="hidden sm:block">Assignee</span>
            <span>Due date</span>
            <span className="hidden sm:block">Priority</span>
          </div>
          {children}
        </>
      )}
    </section>
  );
}

function AddTaskRow({ listId, statusId }: { listId: number; statusId: number }) {
  const create = useCreateTask(listId);
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const submit = () => {
    const n = name.trim();
    if (!n) {
      setActive(false);
      return;
    }
    create.mutate({ name: n, statusId }, { onSuccess: () => setName("") });
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
