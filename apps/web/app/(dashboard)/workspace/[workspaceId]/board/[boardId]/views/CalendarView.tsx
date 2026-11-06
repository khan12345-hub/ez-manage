"use client";

import { useState, useRef, useEffect } from "react";
import { parseDateValue, toDateKey } from "@/lib/date-value";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBoardTasks } from "@/services/boards.api";
import { createTask } from "@/services/tasks.api";
import { updateCell } from "@/services/cells.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { ChevronLeft, ChevronRight, Plus, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface CalendarViewProps {
  board: any;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getDateCell(task: any, columns: any[]) {
  const dateCol = columns.find((c: any) => c.type === "DATE");
  if (!dateCol) return null;
  const cell = task.cells?.find((c: any) => c.columnId === dateCol.id);
  // DATE cell value is { date: string | Date }
  const v = cell?.value as any;
  return v?.date ? String(v.date) : null;
}

interface CreateModalProps {
  dateLabel: string;
  groups: any[];
  onClose: () => void;
  onSubmit: (name: string, groupId: number) => void;
  isSubmitting: boolean;
}

function CreateTaskModal({ dateLabel, groups, onClose, onSubmit, isSubmitting }: CreateModalProps) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | null>(groups[0]?.id ?? null);
  const [groupOpen, setGroupOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close group dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedGroup = groups.find((g: any) => g.id === groupId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !groupId) return;
    onSubmit(name.trim(), groupId);
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[calc(100vw-32px)] max-w-sm rounded-xl border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">New Task</p>
            <p className="text-sm font-semibold">{dateLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
          {/* Task name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Task name</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter task name…"
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            />
          </div>

          {/* Group picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Group</label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setGroupOpen((o) => !o)}
                className="flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 text-sm hover:bg-muted/40 transition-colors"
              >
                {selectedGroup ? (
                  <>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedGroup.color ?? "#6b7280" }}
                    />
                    <span className="flex-1 truncate text-left">{selectedGroup.name}</span>
                  </>
                ) : (
                  <span className="flex-1 text-left text-muted-foreground">Select group</span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>

              {groupOpen && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-card shadow-lg">
                  {groups.map((g: any) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setGroupId(g.id); setGroupOpen(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${
                        groupId === g.id ? "bg-muted/40 font-medium" : ""
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: g.color ?? "#6b7280" }}
                      />
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border py-2 text-sm font-medium hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !groupId || isSubmitting}
              className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating…" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CalendarView({ board }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [creatingForDate, setCreatingForDate] = useState<{ key: string; day: number } | null>(null);
  const open = useTaskDetailsStore((s) => s.open);
  const queryClient = useQueryClient();

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, isError } = useInfiniteQuery({
    queryKey: ["board-tasks", board.id, "calendar"],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 500 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    enabled: !!board.id,
    staleTime: 120_000, // cache for 2 min — re-switching to Calendar tab is instant
  });

  /* Auto-fetch all pages so calendar always shows complete data */
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const allTasks: any[] = Array.from(
    new Map((data?.pages.flatMap((p: any) => p.tasks) ?? []).map((t: any) => [t.id, t])).values()
  );
  const columns: any[] = board.columns ?? [];
  const groups: any[] = board.groups ?? [];
  const dateCol = columns.find((c: any) => c.type === "DATE");

  const createMutation = useMutation({
    mutationFn: async ({ name, groupId, day }: { name: string; groupId: number; day: number }) => {
      // 1. Create the task
      const task = await createTask({ name, groupId }, board.id);

      // 2. If there's a DATE column, set the cell value to the clicked date
      if (dateCol) {
        const dateCell = (task.cells as any[] | undefined)?.find(
          (c: any) => c.columnId === dateCol.id
        );
        if (dateCell) {
          const clickedDate = new Date(year, month, day);
          await updateCell(board.id, dateCell.id, {
            value: { date: toDateKey(clickedDate) },
            ...(dateCell.updatedAt ? { updatedAt: String(dateCell.updatedAt) } : {}),
          });
        }
      }

      return task;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["board-tasks", board.id, "calendar"] });
      setCreatingForDate(null);
      toast.success(`Task "${vars.name}" created`);
    },
    onError: () => {
      toast.error("Failed to create task. Please try again.");
    },
  });

  // Build task map: "YYYY-MM-DD" → tasks[]
  const tasksByDate = new Map<string, any[]>();
  allTasks.forEach((task) => {
    const rawDate = getDateCell(task, columns);
    if (!rawDate) return;
    const d = parseDateValue(rawDate);
    if (!d) return;
    const key = toDateKey(d);
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(task);
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const hasDateCol = columns.some((c: any) => c.type === "DATE");

  if (!isLoading && !hasDateCol) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No Date column found. Add a Date column to use Calendar view.
      </div>
    );
  }

  // Build grid cells
  const cells: Array<{ day: number | null }> = [
    ...Array(firstDay).fill({ day: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push({ day: null });

  // Date label for modal
  const modalDateLabel = creatingForDate
    ? `${MONTH_NAMES[month]} ${creatingForDate.day}, ${year}`
    : "";

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm p-2">
        {/* Header */}
        <div className="flex items-center justify-between px-2 py-2.5">
          <h2 className="font-serif text-[24px] font-normal leading-none text-foreground">
            {MONTH_NAMES[month]} {year}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 px-px">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-px rounded-lg bg-border overflow-hidden">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-card animate-pulse sm:h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px rounded-lg bg-border overflow-hidden">
            {cells.map((cell, i) => {
              if (!cell.day) {
                return <div key={i} className="h-20 bg-muted/40 sm:h-28" />;
              }
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
              const dayTasks = tasksByDate.get(key) ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={i}
                  className={`group relative h-20 p-1.5 flex flex-col overflow-hidden transition-colors sm:h-28 ${
                    isToday ? "bg-primary/[0.06]" : "bg-card hover:bg-muted/30"
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between mb-0.5">
                    <span
                      className={`h-5 w-5 flex items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {cell.day}
                    </span>

                    {/* + Add button — visible on hover */}
                    <button
                      onClick={() => setCreatingForDate({ key, day: cell.day! })}
                      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Add
                    </button>
                  </div>

                  {/* Tasks */}
                  <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                    {dayTasks.slice(0, 4).map((task: any) => {
                      const group = groups.find((g: any) => g.id === task.groupId);
                      return (
                        <button
                          key={task.id}
                          onClick={() => open({ taskId: task.id, boardId: board.id, groupId: task.groupId })}
                          className="flex items-center gap-1 rounded px-1 py-px text-left text-[10.5px] leading-tight font-medium hover:bg-muted/60 transition-colors"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: group?.color ?? "#6b7280" }}
                          />
                          <span className="truncate">{task.name}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length > 4 && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        +{dayTasks.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create task modal */}
      {creatingForDate && (
        <CreateTaskModal
          dateLabel={modalDateLabel}
          groups={groups}
          onClose={() => setCreatingForDate(null)}
          isSubmitting={createMutation.isPending}
          onSubmit={(name, groupId) => {
            createMutation.mutate({ name, groupId, day: creatingForDate.day });
          }}
        />
      )}
    </>
  );
}
