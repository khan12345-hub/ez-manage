"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileIcon,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Plus,
  User2,
} from "lucide-react";
import { getBoardTasks } from "@/services/boards.api";
import { createCell, updateCell } from "@/services/cells.api";
import { useTaskDetailsStore } from "@/store/task-details-store";

interface KanbanViewProps {
  board: any;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";

/* ─── Types ────────────────────────────────────────────────── */

interface DragItem {
  taskId: number;
  statusCellId: number | null;
  statusColumnId: number | null;
  sourceLabel: string;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function getCell(task: any, columnId: number) {
  return task.cells?.find((c: any) => c.columnId === columnId) ?? null;
}

function getColumnByType(columns: any[], type: string) {
  return columns?.find((c: any) => c.type === type) ?? null;
}

function formatDate(iso: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso: string) {
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d < new Date();
}

function getTaskFiles(task: any) {
  const files: { id: number; name: string; url: string; mimeType: string }[] = [];
  for (const cell of task.cells ?? []) {
    if (cell.column?.type !== "FILE") continue;
    for (const f of cell.files ?? []) {
      if (f.file?.url) {
        files.push({
          id: f.file.id,
          name: f.file.fileName ?? "file",
          url: f.file.url as string,
          mimeType: f.file.mimeType ?? "",
        });
      }
    }
  }
  return files;
}

/* ─── Avatar strip ─────────────────────────────────────────── */

function AvatarStrip({ users }: { users: any[] }) {
  const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#06b6d4", "#eab308"];
  return (
    <div className="flex -space-x-1.5">
      {users.slice(0, 4).map((u: any, i: number) => {
        const initials = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
        const bg = COLORS[(u.id ?? i) % COLORS.length];
        return u.avatarUrl ? (
          <img
            key={u.id}
            src={u.avatarUrl}
            alt={initials}
            title={`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()}
            className="h-6 w-6 rounded-full border-2 border-background object-cover"
          />
        ) : (
          <div
            key={u.id}
            title={`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[9px] font-bold text-white"
            style={{ backgroundColor: bg }}
          >
            {initials}
          </div>
        );
      })}
      {users.length > 4 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[9px] font-semibold text-muted-foreground">
          +{users.length - 4}
        </div>
      )}
    </div>
  );
}

/* ─── File Carousel ────────────────────────────────────────── */

function FileCarousel({ files }: { files: { id: number; name: string; url: string; mimeType: string }[] }) {
  const [idx, setIdx] = useState(0);

  if (files.length === 0) return null;

  const file = files[idx];
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => Math.max(0, i - 1));
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIdx((i) => Math.min(files.length - 1, i + 1));
  };

  return (
    <div className="relative mb-2 h-[130px] w-full overflow-hidden rounded-md bg-muted">
      {isImage ? (
        <img
          src={BASE_URL + file.url}
          alt={file.name}
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
          <FileIcon className={`h-10 w-10 ${isPdf ? "text-red-500" : "text-blue-500"}`} />
          <span className="max-w-[90%] truncate px-2 text-[10px] text-muted-foreground">
            {file.name}
          </span>
        </div>
      )}

      {/* Arrows */}
      {files.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-30 hover:bg-black/70"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={idx === files.length - 1}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-30 hover:bg-black/70"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Counter */}
      <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {idx + 1} / {files.length}
      </div>
    </div>
  );
}

/* ─── Task card ────────────────────────────────────────────── */

function TaskCard({
  task,
  columns,
  boardId,
  statusColumnId,
  onDragStart,
}: {
  task: any;
  columns: any[];
  boardId: number;
  statusColumnId: number | null;
  onDragStart: (item: DragItem) => void;
}) {
  const open = useTaskDetailsStore((s) => s.open);

  // Person
  const personCol = getColumnByType(columns, "PERSON");
  const personCell = personCol ? getCell(task, personCol.id) : null;
  const assignees: any[] = personCell?.value?.users ?? [];

  // Date
  const dateCol = getColumnByType(columns, "DATE");
  const dateCell = dateCol ? getCell(task, dateCol.id) : null;
  const dateVal: string | null = dateCell?.value?.date ?? null;
  const dateStr = dateVal ? formatDate(dateVal) : null;
  const overdue = dateVal ? isOverdue(dateVal) : false;

  // Counts
  const commentCount: number = task._count?.comments ?? 0;
  const subtaskCount: number = task._count?.subtasks ?? 0;
  const subtaskDone: number = (task.subtasks as any[] | undefined)?.filter((s: any) => s.done).length ?? 0;

  // Files
  const files = getTaskFiles(task);

  // Status cell
  const statusCell = statusColumnId ? getCell(task, statusColumnId) : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    onDragStart({
      taskId: task.id,
      statusCellId: statusCell?.id ?? null,
      statusColumnId,
      sourceLabel: statusCell?.value?.label ?? "",
    });
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => open({ taskId: task.id, boardId, groupId: task.groupId })}
      className="group cursor-grab rounded-xl border bg-background shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing active:opacity-70"
    >
      {/* File carousel */}
      {files.length > 0 && (
        <div className="px-3 pt-3">
          <FileCarousel files={files} />
        </div>
      )}

      {/* Card body */}
      <div className="px-3 pb-3 pt-3 space-y-2.5">
        {/* Task name + actions */}
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-xs font-medium leading-snug text-foreground line-clamp-2">
            {task.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {commentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>{commentCount}</span>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Assign */}
        <div className="flex items-center gap-2">
          <User2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {assignees.length > 0 ? (
            <AvatarStrip users={assignees} />
          ) : (
            <span className="text-[11px] text-muted-foreground">Assign...</span>
          )}
        </div>

        {/* Due date */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {dateStr ? (
            <span className={`text-[11px] font-medium ${overdue ? "text-red-500" : "text-muted-foreground"}`}>
              {dateStr}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Due D...</span>
          )}
        </div>

        {/* Subtask */}
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {subtaskCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                {subtaskDone}/{subtaskCount}
              </span>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${(subtaskDone / subtaskCount) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">Subitem...</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Kanban Column ────────────────────────────────────────── */

function KanbanColumn({
  label,
  color,
  tasks,
  columns,
  boardId,
  statusColumnId,
  statusOption,
  onDragStart,
  onDrop,
}: {
  label: string;
  color: string;
  tasks: any[];
  columns: any[];
  boardId: number;
  statusColumnId: number | null;
  statusOption: any;
  onDragStart: (item: DragItem) => void;
  onDrop: (targetOption: any) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`flex w-[270px] shrink-0 flex-col rounded-xl border shadow-sm transition-colors ${
        isDragOver ? "border-primary/60 bg-primary/5" : "bg-muted/10"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(statusOption);
      }}
    >
      {/* Colored header */}
      <div
        className="flex items-center justify-between rounded-t-xl px-3 py-2.5"
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-semibold text-white drop-shadow-sm">
            {label}
          </span>
          <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold text-white">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-white/80 hover:bg-white/20 transition-colors"
          title="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cards */}
      <div
        className="flex flex-col gap-2.5 overflow-y-auto p-2.5"
        style={{ maxHeight: "calc(100vh - 240px)" }}
      >
        {tasks.length === 0 ? (
          <div
            className={`flex h-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground transition-colors ${
              isDragOver ? "border-primary/40 bg-primary/5" : ""
            }`}
          >
            {isDragOver ? "Drop here" : "No tasks"}
          </div>
        ) : (
          tasks.map((task: any) => (
            <TaskCard
              key={task.id}
              task={task}
              columns={columns}
              boardId={boardId}
              statusColumnId={statusColumnId}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Main View ────────────────────────────────────────────── */

export function KanbanView({ board }: KanbanViewProps) {
  const queryClient = useQueryClient();
  const dragItem = useRef<DragItem | null>(null);

  const statusCol = board.columns?.find((c: any) => c.type === "STATUS") ?? null;

  // Reuse main board cache (no-filter key) so switching tabs doesn't refetch
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<any>({
    queryKey: ["board-tasks", board.id, "", null],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: (pageParam as number | undefined) ?? undefined, limit: 100 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    staleTime: 30_000,
    enabled: !!board.id,
  });

  const allTasks: any[] = Array.from(
    new Map(
      (data?.pages.flatMap((p: any) => p.tasks) ?? []).map((t: any) => [t.id, t])
    ).values()
  );
  const totalTaskCount: number = (data?.pages[0] as any)?.total ?? 0;
  const remainingTasks = Math.max(0, totalTaskCount - allTasks.length);

  const handleDragStart = (item: DragItem) => {
    dragItem.current = item;
  };

  const handleDrop = async (targetOption: any) => {
    const item = dragItem.current;
    dragItem.current = null;
    if (!item || !targetOption) return;
    if (item.sourceLabel === targetOption.label) return;

    const value = { label: targetOption.label, color: targetOption.color };

    try {
      let cellId = item.statusCellId;

      // Task had no STATUS cell yet — create it first
      if (!cellId && item.statusColumnId) {
        const created = await createCell(board.id, item.taskId, item.statusColumnId);
        cellId = created.id;
      }

      if (!cellId) return;

      await updateCell(board.id, cellId, { value });

      // Optimistically update cached tasks
      queryClient.setQueriesData(
        { queryKey: ["board-tasks", board.id] },
        (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              tasks: page.tasks.map((t: any) => {
                if (t.id !== item.taskId) return t;
                return {
                  ...t,
                  cells: t.cells.map((c: any) =>
                    c.columnId === item.statusColumnId
                      ? { ...c, id: cellId, value }
                      : c,
                  ),
                };
              }),
            })),
          };
        },
      );
    } catch {
      // refetch on error to sync state
      queryClient.invalidateQueries({ queryKey: ["board-tasks", board.id] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[270px] shrink-0 animate-pulse rounded-xl border">
            <div className="h-10 rounded-t-xl bg-muted" />
            <div className="space-y-3 p-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-28 rounded-xl bg-muted/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!statusCol) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No Status column found. Add a Status column to use Kanban view.
      </div>
    );
  }

  const statusOptions: any[] = statusCol.statusOptions ?? [];

  // Group tasks by status
  const lanes: Record<string, any[]> = {};
  statusOptions.forEach((opt: any) => { lanes[opt.label] = []; });
  lanes["__no_status__"] = [];

  allTasks.forEach((task: any) => {
    const cell = getCell(task, statusCol.id);
    const label = (cell?.value as any)?.label as string | undefined;
    if (label && lanes[label] !== undefined) {
      lanes[label].push(task);
    } else {
      lanes["__no_status__"].push(task);
    }
  });

  const displayCols = [
    ...statusOptions.map((opt: any) => ({
      key: String(opt.id ?? opt.label),
      label: opt.label as string,
      color: (opt.color as string) ?? "#6b7280",
      tasks: lanes[opt.label as string] ?? [],
      statusOption: opt,
    })),
    ...((lanes["__no_status__"]?.length ?? 0) > 0
      ? [{
          key: "__no_status__",
          label: "No Status",
          color: "#9ca3af",
          tasks: lanes["__no_status__"],
          statusOption: null,
        }]
      : []),
  ];

  return (
    <div
      className="flex flex-col gap-3 overflow-x-auto pb-8 pt-2 px-1"
      onDragEnd={() => { dragItem.current = null; }}
    >
      <div className="flex gap-4">
        {displayCols.map((col) => (
          <KanbanColumn
            key={col.key}
            label={col.label}
            color={col.color}
            tasks={col.tasks}
            columns={board.columns}
            boardId={board.id}
            statusColumnId={statusCol.id}
            statusOption={col.statusOption}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Load more — below all columns */}
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 rounded-md border bg-background px-5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 shadow-sm"
          >
            {isFetchingNextPage ? (
              "Loading..."
            ) : (
              <>
                Load more
                {remainingTasks > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {remainingTasks.toLocaleString()} remaining
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
