import { api } from "@/lib/api";

export interface TimeEntry {
  id: number;
  taskId: number;
  boardId: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  note: string | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export async function getTimeEntries(boardId: number, taskId: number): Promise<TimeEntry[]> {
  const { data } = await api.get(`/boards/${boardId}/tasks/${taskId}/time-entries`);
  return data;
}

export async function startTimer(boardId: number, taskId: number, note?: string): Promise<TimeEntry> {
  const { data } = await api.post(`/boards/${boardId}/tasks/${taskId}/time-entries/start`, { note });
  return data;
}

export async function stopTimer(boardId: number, taskId: number): Promise<TimeEntry> {
  const { data } = await api.post(`/boards/${boardId}/tasks/${taskId}/time-entries/stop`);
  return data;
}

export async function logManualTime(
  boardId: number,
  taskId: number,
  durationMs: number,
  note?: string,
): Promise<TimeEntry> {
  const { data } = await api.post(`/boards/${boardId}/tasks/${taskId}/time-entries/manual`, {
    durationMs,
    note,
  });
  return data;
}

export async function deleteTimeEntry(
  boardId: number,
  taskId: number,
  entryId: number,
): Promise<void> {
  await api.delete(`/boards/${boardId}/tasks/${taskId}/time-entries/${entryId}`);
}

export async function getActiveTimer(boardId: number, taskId: number): Promise<TimeEntry | null> {
  const { data } = await api.get(`/boards/${boardId}/tasks/${taskId}/time-entries/active`);
  return data;
}

export async function getMyActiveTimer(): Promise<{
  startedAt: string;
  taskId: number;
  boardId: number;
  task: { name: string; groupId: number };
} | null> {
  const { data } = await api.get(`/time-entries/my-active`);
  return data;
}

// ─── Time report export ───────────────────────────────────────────────────────

export interface TimeReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
}

export async function downloadTimeReport(
  boardId: number,
  boardName: string,
  filters: TimeReportFilters = {},
) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.userId) params.set("userId", String(filters.userId));

  const response = await api.get(`/boards/${boardId}/time-entries/export`, {
    params,
    responseType: "blob",
  });

  const safeName = boardName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  const today = new Date().toISOString().split("T")[0];
  const filename = `time-report-${safeName}-${today}.csv`;

  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface TimesheetRow {
  task: {
    id: number;
    name: string;
    boardId: number;
    boardName: string;
    groupId: number;
    groupName: string;
    statusLabel: string | null;
    statusColor: string | null;
  };
  days: Record<string, number>;
  totalMs: number;
}

export interface TimesheetDayEntry {
  id: number;
  taskId: number;
  taskName: string;
  boardId: number;
  boardName: string;
  groupId: number;
  groupName: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  note: string | null;
}

export interface TimesheetData {
  weekDates: string[];
  rows: TimesheetRow[];
  dayTotals: Record<string, number>;
  weekTotalMs: number;
  entries: { date: string; dayTotalMs: number; items: TimesheetDayEntry[] }[];
}

export async function getMyTimesheet(workspaceId: string | number, weekStart: string): Promise<TimesheetData> {
  const { data } = await api.get<TimesheetData>("/time-entries/my-timesheet", {
    params: { workspaceId, weekStart },
  });
  return data;
}

export interface BoardTimeSummary {
  totalMs: number;
  totalHours: number;
  budgetHours: number | null;
  percentage: number | null;
}

export async function getBoardTimeSummary(boardId: number): Promise<BoardTimeSummary> {
  const { data } = await api.get<BoardTimeSummary>(`/boards/${boardId}/time-entries/summary`);
  return data;
}
