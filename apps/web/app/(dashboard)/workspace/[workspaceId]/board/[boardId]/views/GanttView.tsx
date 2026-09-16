"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getBoardTasks } from "@/services/boards.api";
import { updateCell } from "@/services/cells.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEK_W = 110;     // px per week column
const DAY_PX = WEEK_W / 7;
const ROW_H   = 42;
const LEFT_W  = 280;   // px for task-name + date-range panel
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday of the week containing `d` */
function getMondayOf(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : startOfDay(d);
}

function formatRange(start: Date | null, end: Date | null): string {
  if (!start && !end) return "";
  if (!end) return `${MONTHS_SHORT[start!.getMonth()]} ${start!.getDate()}`;
  if (!start) return `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} - ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}

// ─── Week builder ─────────────────────────────────────────────────────────────
interface WeekCol {
  monday: Date;
  friday: Date;
  weekNum: number;
  monthKey: string; // "June 2026"
  label: string;    // "W24  8 - 12"
}

function buildWeeks(windowMonday: Date, numWeeks: number): WeekCol[] {
  return Array.from({ length: numWeeks }, (_, i) => {
    const monday = addDays(windowMonday, i * 7);
    const friday = addDays(monday, 4);
    const weekNum = getISOWeek(monday);
    const monthKey = `${MONTHS_FULL[monday.getMonth()]} ${monday.getFullYear()}`;
    const label = `W${weekNum}  ${monday.getDate()} - ${friday.getDate()}`;
    return { monday, friday, weekNum, monthKey, label };
  });
}

// ─── Bar layout ───────────────────────────────────────────────────────────────
function getBarLayout(
  start: Date | null,
  end:   Date | null,
  windowStart: Date,
  totalDays: number,
  deltaDays = 0,
) {
  const s = start ? addDays(start, deltaDays) : null;
  const e = end   ? addDays(end,   deltaDays) : null;
  const effStart = s ?? e ?? startOfDay(new Date());
  const effEnd   = e ?? s ?? startOfDay(new Date());

  const leftDay  = Math.floor((effStart.getTime() - windowStart.getTime()) / 86400000);
  const rightDay = Math.floor((effEnd.getTime()   - windowStart.getTime()) / 86400000);

  if (rightDay < 0 || leftDay >= totalDays) return null;

  const cl = Math.max(leftDay,  0);
  const cr = Math.min(rightDay, totalDays - 1);

  return {
    left:  cl * DAY_PX,
    width: Math.max((cr - cl + 1) * DAY_PX, DAY_PX * 1.4),
  };
}

// ─── Task Popup ───────────────────────────────────────────────────────────────
interface PopupInfo {
  taskId: number;
  groupId: number;
  name: string;
  groupName: string;
  groupColor: string;
  dateRange: string;
  x: number;
  y: number;
}

function TaskPopup({ info, boardId, onOpen, onClose }: {
  info: PopupInfo;
  boardId: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-50 w-56 rounded-xl border bg-background shadow-xl p-3 space-y-2"
      style={{ left: info.x, top: info.y }}
      onMouseLeave={onClose}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: info.groupColor }} />
        <span className="text-xs font-semibold truncate flex-1">{info.name}</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span className="truncate">{info.groupName}</span>
      </div>
      {info.dateRange && (
        <div className="text-[11px] font-medium text-foreground bg-muted/50 rounded-md px-2 py-1 text-center">
          {info.dateRange}
        </div>
      )}
      <button
        onClick={onOpen}
        className="w-full rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Open task
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface GanttViewProps { board: any }

export function GanttView({ board }: GanttViewProps) {
  const open = useTaskDetailsStore((s) => s.open);
  const queryClient = useQueryClient();
  const today = startOfDay(new Date());

  const [numWeeks, setNumWeeks] = useState(10);
  const [windowMonday, setWindowMonday] = useState(() => addDays(getMondayOf(today), -7));
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  // Drag state (ref = no re-render during move)
  const dragRef = useRef<{
    taskId: number;
    cellId: number;
    type: "TIMELINE" | "DATE";
    origStart: Date;
    origEnd: Date;
    startX: number;
    deltaDays: number;
  } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ taskId: number; deltaDays: number } | null>(null);

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ["board-tasks-gantt", board.id],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 500 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    enabled: !!board.id,
  });

  const allTasks: any[] = data?.pages.flatMap((p: any) => p.tasks) ?? [];
  const columns: any[] = board.columns ?? [];
  const groups:  any[] = board.groups  ?? [];

  // Prefer TIMELINE column, fallback to DATE columns
  const timelineCol = columns.find((c: any) => c.type === "TIMELINE");
  const dateCols    = columns.filter((c: any) => c.type === "DATE");
  const hasDateInfo = !!timelineCol || dateCols.length > 0;

  const startDateColId = dateCols[0]?.id as number | undefined;
  const endDateColId   = (dateCols[1]?.id ?? dateCols[0]?.id) as number | undefined;

  const groupMap = useMemo(() => {
    const m = new Map<number, any>();
    groups.forEach((g: any) => m.set(g.id as number, g));
    return m;
  }, [groups]);

  // Build rows
  const taskRows = useMemo(() => {
    return allTasks
      .map((task: any) => {
        let start: Date | null = null;
        let end:   Date | null = null;
        let cellId: number | null = null;
        let cellType: "TIMELINE" | "DATE" = "DATE";

        if (timelineCol) {
          const cell = task.cells?.find((c: any) => c.columnId === timelineCol.id);
          if (cell) {
            cellId   = cell.id;
            cellType = "TIMELINE";
            const v  = cell.value as any;
            start    = parseDate(v?.startDate);
            end      = parseDate(v?.endDate);
          }
        } else {
          const sc = task.cells?.find((c: any) => c.columnId === startDateColId);
          const ec = task.cells?.find((c: any) => c.columnId === endDateColId);
          // DATE cell value is { date: string }, not a raw string
          if (sc) { cellId = sc.id; cellType = "DATE"; start = parseDate((sc.value as any)?.date ?? sc.value); }
          if (ec) end = parseDate((ec.value as any)?.date ?? ec.value);
        }

        const group = groupMap.get(task.groupId as number);
        return { task, start, end, cellId, cellType, group };
      })
      .filter((r) => r.start || r.end);
  }, [allTasks, timelineCol, startDateColId, endDateColId, groupMap]);

  const weeks    = useMemo(() => buildWeeks(windowMonday, numWeeks), [windowMonday, numWeeks]);
  const totalDays = numWeeks * 7;
  const totalWidth = numWeeks * WEEK_W;
  const windowStart = windowMonday;

  // Month groups for top header
  const monthGroups = useMemo(() => {
    const result: { key: string; label: string; count: number }[] = [];
    weeks.forEach((w) => {
      const last = result[result.length - 1];
      if (last && last.key === w.monthKey) {
        last.count++;
      } else {
        result.push({ key: w.monthKey, label: w.monthKey, count: 1 });
      }
    });
    return result;
  }, [weeks]);

  const todayOffsetPx = (today.getTime() - windowStart.getTime()) / 86400000 * DAY_PX + DAY_PX / 2;

  // ── Drag handler ──────────────────────────────────────────────────────────
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, taskId: number, cellId: number | null, cellType: "TIMELINE" | "DATE", start: Date | null, end: Date | null) => {
      if (!cellId || (!start && !end)) return;
      e.preventDefault();
      e.stopPropagation();
      setPopup(null);

      dragRef.current = {
        taskId,
        cellId,
        type: cellType,
        origStart: start ?? end!,
        origEnd:   end   ?? start!,
        startX:    e.clientX,
        deltaDays: 0,
      };
      setDragInfo({ taskId, deltaDays: 0 });

      const onMove = (me: MouseEvent) => {
        if (!dragRef.current) return;
        const deltaDays = Math.round((me.clientX - dragRef.current.startX) / DAY_PX);
        if (deltaDays !== dragRef.current.deltaDays) {
          dragRef.current.deltaDays = deltaDays;
          setDragInfo({ taskId: dragRef.current.taskId, deltaDays });
        }
      };

      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!dragRef.current) return;
        const { cellId: cId, type, origStart, origEnd, deltaDays } = dragRef.current;
        dragRef.current = null;
        setDragInfo(null);
        if (deltaDays === 0) return;

        const newStart = addDays(origStart, deltaDays);
        const newEnd   = addDays(origEnd,   deltaDays);
        const value = type === "TIMELINE"
          ? { startDate: newStart.toISOString(), endDate: newEnd.toISOString() }
          : { date: newStart.toISOString() }; // DATE cell format: { date: ISO }
        await updateCell(board.id, cId, { value });
        queryClient.invalidateQueries({ queryKey: ["board-tasks-gantt", board.id] });
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [board.id, queryClient],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!isLoading && !hasDateInfo) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No Date or Timeline column found. Add one to use Gantt view.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setWindowMonday(d => addDays(d, -7))} className="rounded p-1.5 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setWindowMonday(addDays(getMondayOf(today), -7))} className="rounded px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors">
            Today
          </button>
          <button onClick={() => setWindowMonday(d => addDays(d, 7))} className="rounded p-1.5 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 ml-auto">
          {([6, 10, 16] as const).map((n) => (
            <button
              key={n}
              onClick={() => setNumWeeks(n)}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                numWeeks === n ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {n}W
            </button>
          ))}
        </div>
      </div>

      {/* Gantt table */}
      <div className="overflow-x-auto rounded-xl border select-none" onMouseLeave={() => { if (!dragRef.current) setPopup(null); }}>
        <div style={{ minWidth: `${totalWidth + LEFT_W}px` }}>

          {/* ── Header row 1: Months ── */}
          <div className="flex border-b bg-muted/40 sticky top-0 z-20">
            <div style={{ width: LEFT_W }} className="shrink-0 border-r px-3 py-2 text-xs font-semibold text-muted-foreground">
              Task
            </div>
            <div className="flex" style={{ width: totalWidth }}>
              {monthGroups.map((mg) => (
                <div
                  key={mg.key}
                  style={{ width: mg.count * WEEK_W }}
                  className="shrink-0 border-r px-2 py-2 text-xs font-semibold"
                >
                  {mg.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Header row 2: Weeks ── */}
          <div className="flex border-b bg-muted/20 sticky top-[33px] z-20">
            <div style={{ width: LEFT_W }} className="shrink-0 border-r" />
            <div className="flex" style={{ width: totalWidth }}>
              {weeks.map((w, i) => {
                const isThisWeek = today >= w.monday && today <= addDays(w.monday, 6);
                return (
                  <div
                    key={i}
                    style={{ width: WEEK_W }}
                    className={`shrink-0 border-r px-1 py-1.5 text-[10px] font-medium text-center ${
                      isThisWeek ? "text-primary bg-primary/5" : "text-muted-foreground"
                    }`}
                  >
                    {w.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Task rows ── */}
          {taskRows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No tasks with dates in this period
            </div>
          ) : (
            taskRows.map(({ task, start, end, cellId, cellType, group }, idx) => {
              const color = (group?.color as string | undefined) ?? "#6b7280";
              const delta = dragInfo !== null && dragInfo.taskId === task.id ? dragInfo.deltaDays : 0;
              const layout = getBarLayout(start, end, windowStart, totalDays, delta);
              const dateRange = formatRange(
                start ? addDays(start, delta) : null,
                end   ? addDays(end,   delta) : null,
              );
              const isDragging = dragInfo?.taskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`flex border-b last:border-b-0 ${idx % 2 === 1 ? "bg-muted/10" : "bg-background"}`}
                  style={{ height: ROW_H }}
                >
                  {/* Left panel */}
                  <div
                    style={{ width: LEFT_W }}
                    className="shrink-0 border-r px-3 flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => open({ taskId: task.id, boardId: board.id, groupId: task.groupId })}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium truncate flex-1">{task.name}</span>
                    {dateRange && (
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden md:block">{dateRange}</span>
                    )}
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative overflow-hidden" style={{ width: totalWidth, height: ROW_H }}>
                    {/* Weekend shading */}
                    {weeks.map((w, wi) => (
                      [5, 6].map((offset) => {
                        const dayIdx = wi * 7 + offset;
                        return (
                          <div
                            key={`${wi}-${offset}`}
                            className="absolute top-0 bottom-0 bg-muted/25"
                            style={{ left: dayIdx * DAY_PX, width: DAY_PX }}
                          />
                        );
                      })
                    ))}

                    {/* Week dividers */}
                    {weeks.map((_, wi) => (
                      <div
                        key={wi}
                        className="absolute top-0 bottom-0 border-r border-muted/60"
                        style={{ left: (wi + 1) * WEEK_W - 0.5 }}
                      />
                    ))}

                    {/* Today line */}
                    {todayOffsetPx >= 0 && todayOffsetPx <= totalWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-primary/60 z-10"
                        style={{ left: todayOffsetPx }}
                      />
                    )}

                    {/* Gantt bar */}
                    {layout && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 rounded-lg flex items-center px-2 overflow-hidden z-20 ${
                          isDragging ? "opacity-80 cursor-grabbing" : "cursor-grab hover:brightness-95 transition-all"
                        }`}
                        style={{
                          left:   layout.left,
                          width:  layout.width,
                          height: 26,
                          backgroundColor: color,
                          userSelect: "none",
                        }}
                        onMouseDown={(e) => handleBarMouseDown(e, task.id, cellId, cellType, start, end)}
                        onMouseEnter={(e) => {
                          if (!dragRef.current) {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setPopup({
                              taskId:     task.id,
                              groupId:    task.groupId,
                              name:       task.name,
                              groupName:  group?.name ?? "",
                              groupColor: color,
                              dateRange,
                              x: rect.left,
                              y: rect.bottom + 8,
                            });
                          }
                        }}
                      >
                        <span className="text-[10px] font-medium text-white truncate leading-none">
                          {task.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <TaskPopup
          info={popup}
          boardId={board.id}
          onOpen={() => {
            open({ taskId: popup.taskId, boardId: board.id, groupId: popup.groupId });
            setPopup(null);
          }}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}
