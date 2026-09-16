import { api } from "@/lib/api";

export interface TimeEntry {
  id: number;
  taskId: number;
  userId: number;
  boardId: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  note: string | null;
  createdAt: string;
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
  startedAt?: string,
): Promise<TimeEntry> {
  const { data } = await api.post(`/boards/${boardId}/tasks/${taskId}/time-entries/manual`, {
    durationMs,
    note,
    startedAt,
  });
  return data;
}

export async function deleteTimeEntry(boardId: number, taskId: number, entryId: number): Promise<void> {
  await api.delete(`/boards/${boardId}/tasks/${taskId}/time-entries/${entryId}`);
}

export async function getActiveTimer(boardId: number, taskId: number): Promise<TimeEntry | null> {
  const { data } = await api.get(`/boards/${boardId}/tasks/${taskId}/time-entries/active`);
  return data;
}

export interface ActiveTimerWithTask {
  id: number;
  taskId: number;
  userId: number;
  boardId: number;
  startedAt: string;
  endedAt: null;
  durationMs: null;
  note: string | null;
  task: { id: number; name: string; groupId: number };
  board: { id: number; name: string };
}

export async function getMyActiveTimer(): Promise<ActiveTimerWithTask | null> {
  const { data } = await api.get(`/time-entries/my-active`);
  return data;
}
