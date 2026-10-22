"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { getWorkspaceCalendarTasks, WorkspaceCalendarTask } from "@/services/workspace.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

interface Props {
  workspaceId: string | number;
}

export default function WorkspaceCalendar({ workspaceId }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [filterBoardId, setFilterBoardId] = useState<number | null>(null);

  const { open } = useTaskDetailsStore();

  const { data = [], isLoading } = useQuery({
    queryKey: ["workspace-calendar-tasks", workspaceId, month, year],
    queryFn: () => getWorkspaceCalendarTasks(workspaceId, month, year),
    staleTime: 30_000,
  });

  // All distinct boards for filter
  const boards = useMemo(() => {
    const map = new Map<number, string>();
    data.forEach((t) => map.set(t.boardId, t.boardName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filteredTasks = filterBoardId
    ? data.filter((t) => t.boardId === filterBoardId)
    : data;

  // Group by date key "YYYY-MM-DD"
  const tasksByDate = useMemo(() => {
    const map = new Map<string, WorkspaceCalendarTask[]>();
    filteredTasks.forEach((task) => {
      const d = new Date(task.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    });
    return map;
  }, [filteredTasks]);

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: Array<{ day: number | null }> = [
    ...Array(firstDay).fill({ day: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];
  while (cells.length % 7 !== 0) cells.push({ day: null });

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Workspace Calendar</h1>
        <span className="text-xs text-muted-foreground">· All boards</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-5">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="min-w-[130px] text-center text-base font-semibold">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); }}
              className="ml-1 rounded-md px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
            >
              Today
            </button>
          </div>

          {/* Board filter */}
          {boards.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterBoardId(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filterBoardId === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                All boards
              </button>
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setFilterBoardId(b.id === filterBoardId ? null : b.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filterBoardId === b.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-1.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-background animate-pulse sm:h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {cells.map((cell, i) => {
              if (!cell.day) {
                return <div key={i} className="h-20 bg-muted/30 sm:h-28" />;
              }
              const key = `${year}-${String(month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
              const dayTasks = tasksByDate.get(key) ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={i}
                  className="group relative h-20 bg-background p-1 flex flex-col overflow-hidden sm:h-28"
                >
                  <span
                    className={cn(
                      "h-5 w-5 flex items-center justify-center rounded-full text-xs font-medium mb-0.5 shrink-0",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {cell.day}
                  </span>

                  <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                    {dayTasks.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => open({ taskId: task.id, boardId: task.boardId, groupId: task.groupId })}
                        title={`${task.boardName} · ${task.groupName}\n${task.name}`}
                        className="flex items-center gap-1 rounded px-1 py-px text-left text-[9px] leading-tight font-medium hover:bg-muted/60 transition-colors"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: task.groupColor ?? "#6b7280" }}
                        />
                        <span className="truncate">{task.name}</span>
                      </button>
                    ))}
                    {dayTasks.length > 4 && (
                      <span className="text-[9px] text-muted-foreground px-1">
                        +{dayTasks.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            No tasks with dates in {MONTH_NAMES[month - 1]} {year}.
          </p>
        )}
      </div>
    </div>
  );
}
