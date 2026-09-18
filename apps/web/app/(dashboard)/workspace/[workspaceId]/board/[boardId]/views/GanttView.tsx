"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getBoardTasks } from "@/services/boards.api";
import { updateCell } from "@/services/cells.api";
import { useTaskDetailsStore } from "@/store/task-details-store";
import {
  AlignLeft, ChevronDown, ChevronLeft, ChevronRight,
  Maximize2, MoreHorizontal, Settings, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────
type Scale = "days" | "weeks" | "months" | "quarters" | "years";

interface TimeCell {
  startDate: Date;
  days: number;
  label: string;
  groupKey: string;
  groupLabel: string;
}

interface PopupInfo {
  taskId: number; groupId: number; name: string;
  groupName: string; groupColor: string; dateRange: string;
  x: number; y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_F = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LEFT_W   = 300;
const ROW_H    = 40;

const CELL_W: Record<Scale, number> = {
  days: 40, weeks: 110, months: 100, quarters: 200, years: 220,
};

const DEFAULT_UNITS: Record<Scale, number> = {
  days: 30, weeks: 8, months: 8, quarters: 6, years: 5,
};

const SCALE_OPTIONS: { value: Scale; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "quarters", label: "Quarters" },
  { value: "years", label: "Years" },
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const monday = (d: Date) => { const r = sod(d); r.setDate(r.getDate() - (r.getDay() === 0 ? 6 : r.getDay() - 1)); return r; };
const som    = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const soq    = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const soy    = (d: Date) => new Date(d.getFullYear(), 0, 1);
const dim    = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const qn     = (d: Date) => Math.floor(d.getMonth() / 3) + 1;
const diq    = (d: Date) => { const q = Math.floor(d.getMonth() / 3); return [0,1,2].reduce((a,m) => a + new Date(d.getFullYear(), q*3+m+1, 0).getDate(), 0); };
const diy    = (y: number) => ((y%4===0&&y%100!==0)||y%400===0) ? 366 : 365;

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : sod(d);
}

function getISOWeek(d: Date) {
  const t = new Date(d); t.setHours(0,0,0,0); t.setDate(t.getDate() + 4 - (t.getDay()||7));
  return Math.ceil(((t.getTime() - new Date(t.getFullYear(),0,1).getTime()) / 86400000 + 1) / 7);
}

function formatRange(s: Date|null, e: Date|null) {
  const f = (d:Date) => `${MONTHS_S[d.getMonth()]} ${d.getDate()}, '${String(d.getFullYear()).slice(2)}`;
  if (!s && !e) return "";
  if (!e) return f(s!);
  if (!s) return f(e);
  if (s.getFullYear()===e.getFullYear() && s.getMonth()===e.getMonth())
    return `${MONTHS_S[s.getMonth()]} ${s.getDate()} - ${e.getDate()}, '${String(s.getFullYear()).slice(2)}`;
  return `${f(s)} - ${f(e)}`;
}

// ─── Scale helpers ────────────────────────────────────────────────────────────
function alignScale(d: Date, scale: Scale): Date {
  switch (scale) {
    case "days": return sod(d);
    case "weeks": return monday(d);
    case "months": return som(d);
    case "quarters": return soq(d);
    case "years": return soy(d);
  }
}

function shiftScale(d: Date, scale: Scale, n: number): Date {
  const r = new Date(d);
  switch (scale) {
    case "days": return addDays(r, n);
    case "weeks": return addDays(r, n * 7);
    case "months": r.setMonth(r.getMonth() + n); return som(r);
    case "quarters": r.setMonth(r.getMonth() + n * 3); return soq(r);
    case "years": r.setFullYear(r.getFullYear() + n); return soy(r);
  }
}

function buildCells(scale: Scale, windowStart: Date, numUnits: number): TimeCell[] {
  const cells: TimeCell[] = [];
  let cur = new Date(windowStart);

  if (scale === "days") {
    for (let i = 0; i < numUnits; i++) {
      const d = addDays(windowStart, i);
      const isWknd = d.getDay() === 0 || d.getDay() === 6;
      cells.push({
        startDate: d, days: 1,
        label: String(d.getDate()),
        groupKey: `${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`,
        groupLabel: `${MONTHS_F[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
  } else if (scale === "weeks") {
    for (let i = 0; i < numUnits; i++) {
      const mon = addDays(windowStart, i * 7);
      const fri = addDays(mon, 4);
      cells.push({
        startDate: mon, days: 7,
        label: `W${getISOWeek(mon)}  ${mon.getDate()}-${fri.getDate()}`,
        groupKey: `${MONTHS_F[mon.getMonth()]} ${mon.getFullYear()}`,
        groupLabel: `${MONTHS_F[mon.getMonth()]} ${mon.getFullYear()}`,
      });
    }
  } else if (scale === "months") {
    for (let i = 0; i < numUnits; i++) {
      const d = som(cur);
      cells.push({
        startDate: d, days: dim(d),
        label: MONTHS_S[d.getMonth()] ?? "",
        groupKey: String(d.getFullYear()),
        groupLabel: String(d.getFullYear()),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (scale === "quarters") {
    for (let i = 0; i < numUnits; i++) {
      const qStart = soq(cur);
      const q = qn(qStart);
      for (let m = 0; m < 3; m++) {
        const mDate = new Date(qStart.getFullYear(), qStart.getMonth() + m, 1);
        cells.push({
          startDate: mDate, days: dim(mDate),
          label: MONTHS_S[mDate.getMonth()] ?? "",
          groupKey: `Q${q} ${qStart.getFullYear()}`,
          groupLabel: `Q${q} ${qStart.getFullYear()}`,
        });
      }
      cur.setMonth(cur.getMonth() + 3);
    }
  } else {
    // years
    for (let i = 0; i < numUnits; i++) {
      const yStart = new Date(windowStart.getFullYear() + i, 0, 1);
      for (let q = 0; q < 4; q++) {
        const qStart = new Date(yStart.getFullYear(), q * 3, 1);
        cells.push({
          startDate: qStart, days: diq(qStart),
          label: `Q${q + 1}`,
          groupKey: String(yStart.getFullYear()),
          groupLabel: String(yStart.getFullYear()),
        });
      }
    }
  }

  return cells;
}

// ─── Bar Layout ───────────────────────────────────────────────────────────────
function getBarLayout(
  start: Date|null, end: Date|null,
  windowStart: Date, totalDays: number, dayPx: number, delta = 0,
) {
  const s = start ? addDays(start, delta) : null;
  const e = end   ? addDays(end,   delta) : null;
  const es = s ?? e ?? sod(new Date());
  const ee = e ?? s ?? sod(new Date());
  const ld = Math.floor((es.getTime() - windowStart.getTime()) / 86400000);
  const rd = Math.floor((ee.getTime() - windowStart.getTime()) / 86400000);
  if (rd < 0 || ld >= totalDays) return null;
  const cl = Math.max(ld, 0);
  const cr = Math.min(rd, totalDays - 1);
  return { left: cl * dayPx, width: Math.max((cr - cl + 1) * dayPx, dayPx * 1.5) };
}

// ─── Task Popup ───────────────────────────────────────────────────────────────
function TaskPopup({ info, boardId, onOpen, onClose }: {
  info: PopupInfo; boardId: number; onOpen: () => void; onClose: () => void;
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
      <div className="text-[11px] text-muted-foreground truncate">{info.groupName}</div>
      {info.dateRange && (
        <div className="text-[11px] font-medium bg-muted/50 rounded-md px-2 py-1 text-center">{info.dateRange}</div>
      )}
      <button onClick={onOpen} className="w-full rounded-md bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
        Open task
      </button>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
interface SettingsPanelProps {
  board: any;
  onClose: () => void;
  colorBy: "group" | "status";
  onColorByChange: (v: "group" | "status") => void;
  dateCols: any[];
  startColId: number | undefined;
  endColId: number | undefined;
  onStartColChange: (id: number) => void;
  onEndColChange: (id: number) => void;
}

function SettingsPanel({
  board, onClose, colorBy, onColorByChange,
  dateCols, startColId, endColId, onStartColChange, onEndColChange,
}: SettingsPanelProps) {
  const hasStatus = (board.columns ?? []).some((c: any) => c.type === "STATUS");

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold">Widget settings</span>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {/* ── Timeline column ─────────────────────────────────────── */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-sm font-medium">Timeline column</p>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Start date</label>
            <select
              value={startColId ?? ""}
              onChange={(e) => onStartColChange(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {dateCols.length === 0 && <option value="">No date columns</option>}
              {dateCols.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">End date</label>
            <select
              value={endColId ?? ""}
              onChange={(e) => onEndColChange(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {dateCols.length === 0 && <option value="">No date columns</option>}
              {dateCols.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Color by ────────────────────────────────────────────── */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm font-medium">Color by</p>
          <div className="flex gap-2">
            <button
              onClick={() => onColorByChange("group")}
              className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                colorBy === "group"
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Group
            </button>
            {hasStatus && (
              <button
                onClick={() => onColorByChange("status")}
                className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${
                  colorBy === "status"
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Status
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface GanttViewProps { board: any }

export function GanttView({ board }: GanttViewProps) {
  const open = useTaskDetailsStore((s) => s.open);
  const queryClient = useQueryClient();
  const today = sod(new Date());

  const [scale, setScale] = useState<Scale>("years");
  const [numUnits, setNumUnits] = useState(5);
  const [windowStart, setWindowStart] = useState(() => alignScale(addDays(today, -365), "years"));
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [colorBy, setColorBy] = useState<"group" | "status">("group");
  const [startColIdOverride, setStartColIdOverride] = useState<number | undefined>(undefined);
  const [endColIdOverride, setEndColIdOverride] = useState<number | undefined>(undefined);

  const dragRef = useRef<{
    taskId: number; cellId: number;
    type: "TIMELINE" | "DATE";
    origStart: Date; origEnd: Date;
    startX: number; deltaDays: number;
  } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ taskId: number; deltaDays: number } | null>(null);

  // Fetch tasks — reuse main board cache
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["board-tasks", board.id, "", null],
    queryFn: ({ pageParam }) =>
      getBoardTasks(board.id, { cursor: pageParam ?? undefined, limit: 100 }),
    initialPageParam: null as number | null,
    getNextPageParam: (last: any) => (last.hasMore ? last.nextCursor : null),
    staleTime: 30_000,
    enabled: !!board.id,
  });


  const allTasks: any[] = useMemo(() => Array.from(
    new Map(
      (data?.pages.flatMap((p: any) => p.tasks) ?? []).map((t: any) => [t.id, t])
    ).values()
  ), [data]);
  const columns: any[] = board.columns ?? [];
  const groups: any[]  = board.groups  ?? [];

  const allDateCols   = columns.filter((c: any) => c.type === "DATE" || c.type === "TIMELINE");
  const timelineCol   = columns.find((c: any) => c.type === "TIMELINE");
  const dateCols      = columns.filter((c: any) => c.type === "DATE");
  const hasDateInfo   = allDateCols.length > 0;

  // Default start/end column: TIMELINE first, then first/second DATE col
  const defaultStartColId = useMemo(() => {
    if (timelineCol) return timelineCol.id as number;
    return dateCols[0]?.id as number | undefined;
  }, [timelineCol, dateCols]);
  const defaultEndColId = useMemo(() => {
    if (timelineCol) return timelineCol.id as number;
    return ((dateCols[1] ?? dateCols[0])?.id) as number | undefined;
  }, [timelineCol, dateCols]);

  const startDateColId = startColIdOverride ?? defaultStartColId;
  const endDateColId   = endColIdOverride   ?? defaultEndColId;

  const statusCol = useMemo(() => columns.find((c: any) => c.type === "STATUS"), [columns]);

  const groupMap = useMemo(() => {
    const m = new Map<number, any>();
    groups.forEach((g: any) => m.set(g.id as number, g));
    return m;
  }, [groups]);

  // Build task rows using the user-selected start/end columns
  const taskRows = useMemo(() => {
    const startCol = columns.find((c: any) => c.id === startDateColId);
    const endCol   = columns.find((c: any) => c.id === endDateColId);

    return allTasks.map((task: any) => {
      let start: Date | null = null;
      let end: Date | null = null;
      let cellId: number | null = null;
      let cellType: "TIMELINE" | "DATE" = "DATE";

      if (startCol?.type === "TIMELINE") {
        const cell = task.cells?.find((c: any) => c.columnId === startCol.id);
        if (cell) {
          cellId = cell.id; cellType = "TIMELINE";
          const v = cell.value as any;
          start = parseDate(v?.startDate);
          end   = parseDate(v?.endDate);
        }
      } else if (startCol?.type === "DATE") {
        const sc = task.cells?.find((c: any) => c.columnId === startCol.id);
        if (sc) {
          cellId = sc.id; cellType = "DATE";
          start = parseDate((sc.value as any)?.date ?? sc.value);
        }
        if (endCol && endCol.type === "DATE") {
          const ec = task.cells?.find((c: any) => c.columnId === endCol.id);
          if (ec) end = parseDate((ec.value as any)?.date ?? ec.value);
        } else {
          end = start;
        }
      }

      const group = groupMap.get(task.groupId as number);
      return { task, start, end, cellId, cellType, group };
    });
  }, [allTasks, columns, startDateColId, endDateColId, groupMap]);

  // Timeline cells & dimensions
  const cells = useMemo(() => buildCells(scale, windowStart, numUnits), [scale, windowStart, numUnits]);
  const totalDays = cells.reduce((acc, c) => acc + c.days, 0);
  const totalWidth = cells.length * CELL_W[scale];
  const dayPx = totalWidth / totalDays;

  // Top header groups
  const topGroups = useMemo(() => {
    const result: { key: string; label: string; count: number }[] = [];
    cells.forEach((c) => {
      const last = result[result.length - 1];
      if (last?.key === c.groupKey) last.count++;
      else result.push({ key: c.groupKey, label: c.groupLabel, count: 1 });
    });
    return result;
  }, [cells]);

  const todayPx = (today.getTime() - windowStart.getTime()) / 86400000 * dayPx;

  // Auto Fit
  const autoFit = useCallback(() => {
    const dates: Date[] = [];
    taskRows.forEach(({ start, end }) => {
      if (start) dates.push(start);
      if (end)   dates.push(end);
    });
    if (dates.length === 0) return;
    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    const spanDays = (maxD.getTime() - minD.getTime()) / 86400000;

    let newScale: Scale;
    let newUnits: number;
    if (spanDays <= 60) { newScale = "weeks"; newUnits = Math.ceil(spanDays / 7) + 2; }
    else if (spanDays <= 365) { newScale = "months"; newUnits = Math.ceil(spanDays / 30) + 2; }
    else if (spanDays <= 730) { newScale = "quarters"; newUnits = Math.ceil(spanDays / 91) + 2; }
    else { newScale = "years"; newUnits = Math.ceil(spanDays / 365) + 2; }

    setScale(newScale);
    setNumUnits(Math.min(newUnits, 20));
    setWindowStart(alignScale(addDays(minD, -30), newScale));
  }, [taskRows]);

  // Bar color: group color or status color
  const getBarColor = useCallback((task: any, group: any): string => {
    if (colorBy === "status" && statusCol) {
      const cell = task.cells?.find((c: any) => c.columnId === statusCol.id);
      const optionId = (cell?.value as any)?.id;
      const option = (statusCol.statusOptions ?? []).find((o: any) => o.id === optionId);
      if (option?.color) return option.color as string;
    }
    return (group?.color as string) ?? "#6b7280";
  }, [colorBy, statusCol]);

  // Change scale
  const changeScale = (s: Scale) => {
    setScale(s);
    setNumUnits(DEFAULT_UNITS[s]);
    setWindowStart(alignScale(windowStart, s));
  };

  // Navigate
  const goBack = () => setWindowStart(shiftScale(windowStart, scale, -1));
  const goFwd  = () => setWindowStart(shiftScale(windowStart, scale, +1));
  const goToday = () => setWindowStart(alignScale(today, scale));

  // Drag handler
  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, taskId: number, cellId: number|null, cellType: "TIMELINE"|"DATE", start: Date|null, end: Date|null) => {
      if (!cellId || (!start && !end)) return;
      e.preventDefault(); e.stopPropagation();
      setPopup(null);
      dragRef.current = { taskId, cellId, type: cellType, origStart: start ?? end!, origEnd: end ?? start!, startX: e.clientX, deltaDays: 0 };
      setDragInfo({ taskId, deltaDays: 0 });

      const onMove = (me: MouseEvent) => {
        if (!dragRef.current) return;
        const dd = Math.round((me.clientX - dragRef.current.startX) / dayPx);
        if (dd !== dragRef.current.deltaDays) { dragRef.current.deltaDays = dd; setDragInfo({ taskId, deltaDays: dd }); }
      };
      const onUp = async () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (!dragRef.current) return;
        const { cellId: cId, type, origStart, origEnd, deltaDays } = dragRef.current;
        dragRef.current = null; setDragInfo(null);
        if (deltaDays === 0) return;
        const ns = addDays(origStart, deltaDays);
        const ne = addDays(origEnd, deltaDays);
        const value = type === "TIMELINE" ? { startDate: ns.toISOString(), endDate: ne.toISOString() } : { date: ns.toISOString() };
        await updateCell(board.id, cId, { value });
        queryClient.invalidateQueries({ queryKey: ["board-tasks", board.id] });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [board.id, dayPx, queryClient],
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

  const currentScale = SCALE_OPTIONS.find(s => s.value === scale)!;

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Left: nav */}
        <div className="flex items-center gap-0.5 rounded-lg border bg-background px-1 py-0.5">
          <button onClick={goBack} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToday} className="rounded px-2.5 py-0.5 text-xs font-medium hover:bg-muted">
            Today
          </button>
          <button onClick={goFwd} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Auto Fit */}
        <button
          onClick={autoFit}
          className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <AlignLeft className="h-3.5 w-3.5" />
          Auto Fit
        </button>

        {/* Scale selector */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border bg-background px-1 py-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium hover:bg-muted">
                {currentScale.label}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {SCALE_OPTIONS.map((o) => (
                <DropdownMenuItem key={o.value} onClick={() => changeScale(o.value)}
                  className={scale === o.value ? "bg-muted font-medium" : ""}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoom out/in */}
          <button onClick={() => setNumUnits(n => Math.max(2, n - 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-base font-medium text-muted-foreground hover:bg-muted">
            −
          </button>
          <button onClick={() => setNumUnits(n => Math.min(20, n + 1))}
            className="flex h-7 w-7 items-center justify-center rounded text-base font-medium text-muted-foreground hover:bg-muted">
            +
          </button>
        </div>

        {/* Settings icon */}
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${showSettings ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* "..." menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-muted">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setIsFullscreen(v => !v)}>
              <Maximize2 className="mr-2 h-3.5 w-3.5" />
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)}>
              <Settings className="mr-2 h-3.5 w-3.5" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Main area (gantt + optional settings panel) ──────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border">
        {/* Gantt table */}
        <div className="flex-1 overflow-x-auto select-none" onMouseLeave={() => { if (!dragRef.current) setPopup(null); }}>
          <div style={{ minWidth: `${totalWidth + LEFT_W}px` }}>

            {/* Top header: years / quarter-groups / month-groups */}
            <div className="flex border-b bg-muted/40 sticky top-0 z-20">
              <div style={{ width: LEFT_W }} className="shrink-0 border-r px-3 py-2 text-xs font-semibold text-muted-foreground">
                Task
              </div>
              <div className="flex">
                {topGroups.map((g) => (
                  <div
                    key={g.key}
                    style={{ width: g.count * CELL_W[scale] }}
                    className="shrink-0 border-r px-2 py-2 text-xs font-semibold"
                  >
                    {g.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom header: quarters / months / weeks / days */}
            <div className="flex border-b bg-muted/20 sticky top-[33px] z-20">
              <div style={{ width: LEFT_W }} className="shrink-0 border-r" />
              <div className="flex">
                {cells.map((cell, i) => {
                  const cellPx = CELL_W[scale];
                  const isNow = cell.startDate <= today && today < addDays(cell.startDate, cell.days);
                  return (
                    <div
                      key={i}
                      style={{ width: cellPx }}
                      className={`shrink-0 border-r px-1 py-1.5 text-[10px] font-medium text-center truncate ${
                        isNow ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {cell.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task rows */}
            {taskRows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No tasks — click Auto Fit to find tasks with dates
              </div>
            ) : (
              taskRows.map(({ task, start, end, cellId, cellType, group }, idx) => {
                const color = getBarColor(task, group);
                const delta = dragInfo?.taskId === task.id ? (dragInfo?.deltaDays ?? 0) : 0;
                const layout = getBarLayout(start, end, windowStart, totalDays, dayPx, delta);
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
                    <div className="flex-1 relative overflow-hidden" style={{ height: ROW_H }}>
                      {/* Cell dividers */}
                      {cells.map((_, ci) => (
                        <div key={ci} className="absolute top-0 bottom-0 border-r border-muted/40"
                          style={{ left: (ci + 1) * CELL_W[scale] - 0.5 }} />
                      ))}

                      {/* Today line */}
                      {todayPx >= 0 && todayPx <= totalWidth && (
                        <div className="absolute top-0 bottom-0 w-px bg-primary/60 z-10" style={{ left: todayPx }} />
                      )}

                      {/* Gantt bar */}
                      {layout && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 rounded-lg flex items-center px-2 overflow-hidden z-20 ${
                            isDragging ? "opacity-80 cursor-grabbing" : "cursor-grab hover:brightness-95 transition-all"
                          }`}
                          style={{ left: layout.left, width: layout.width, height: 24, backgroundColor: color, userSelect: "none" }}
                          onMouseDown={(e) => handleBarMouseDown(e, task.id, cellId, cellType, start, end)}
                          onMouseEnter={(e) => {
                            if (!dragRef.current) {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setPopup({
                                taskId: task.id, groupId: task.groupId,
                                name: task.name, groupName: group?.name ?? "",
                                groupColor: color, dateRange,
                                x: Math.min(rect.left, window.innerWidth - 248),
                                y: Math.max(8, rect.bottom + 8),
                              });
                            }
                          }}
                        >
                          <span className="text-[10px] font-medium text-white truncate leading-none">{task.name}</span>
                        </div>
                      )}

                      {/* Off-screen indicator */}
                      {!layout && (start || end) && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground/50">
                          {(start ?? end)! < windowStart ? "◀" : "▶"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Load more */}
            {hasNextPage && (
              <div className="flex items-center justify-center border-t py-3">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading…" : `Load more tasks`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel
            board={board}
            onClose={() => setShowSettings(false)}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            dateCols={allDateCols}
            startColId={startDateColId}
            endColId={endDateColId}
            onStartColChange={setStartColIdOverride}
            onEndColChange={setEndColIdOverride}
          />
        )}
      </div>

      {/* Popup */}
      {popup && (
        <TaskPopup
          info={popup} boardId={board.id}
          onOpen={() => { open({ taskId: popup.taskId, boardId: board.id, groupId: popup.groupId }); setPopup(null); }}
          onClose={() => setPopup(null)}
        />
      )}

    </div>
  );
}
