/*
 * EZ Tracker API client (time, screenshots and activity from the desktop app).
 * Attached to Company Work workspaces; kept apart from the other products.
 */
import { api } from "@/lib/api";

export type TrackerUser = { id: number; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
export type TrackerSettings = {
  screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number;
  retentionDays: number; dayStart: string; trackAll: boolean; trackedUserIds: number[];
};
export type TrackerWorkspace = { id: number; uid: string; name: string; color: string; role: string };
export type TrackerOverview = {
  workspace: { uid: string; name: string; color: string } | null; role: string; isManager: boolean; canSeeOthers: boolean;
  settings: TrackerSettings; tracked: boolean; consent: { version: string; acceptedAt: string | null }; devices: number;
};
export type TrackerLiveRow = {
  user: TrackerUser; me: boolean; status: "working" | "offline"; since: string | null;
  task: { id: number; uid: string; name: string } | null; project: string | null;
  todaySeconds: number; todayActivity: number; lastShot: { url: string | null; takenAt: string; blurred: boolean } | null;
};
export type TrackerTimesheetRow = { user: TrackerUser; total: number; days: Record<string, { seconds: number; activity: number }>; tasks: { name: string; uid: string | null; seconds: number }[] };
export type TrackerShot = { id: number; url: string | null; takenAt: string; blurred: boolean; screen: number; hiddenAt: string | null };
export type TrackerSlot = {
  id: number; start: string; seconds: number; keyboard: number; mouse: number; activityPct: number; idleDiscarded: boolean;
  task: { id: number; uid: string; name: string } | null; project: string | null; shots: TrackerShot[];
  apps: { app: string; title: string | null; url: string | null; seconds: number }[];
};
export type TrackerDay = { user: TrackerUser | null; own: boolean; canHide: boolean; slots: TrackerSlot[]; totalSeconds: number };
export type TrackerAttendanceRow = { user: TrackerUser; day: string; firstStart: string; lastEnd: string | null; seconds: number; late: boolean; lateMinutes: number };
export type TrackerDevice = { id: number; name: string; os: string | null; appVersion: string | null; lastSeenAt: string | null; createdAt: string };

const get = async <T,>(url: string) => (await api.get<T>(url)).data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body)).data;
const qs = (o: Record<string, string | number | undefined | null>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();
const offset = () => new Date().getTimezoneOffset();

export const trackerApi = {
  workspaces: () => get<TrackerWorkspace[]>("/tracker/workspaces"),
  overview: (ws: string) => get<TrackerOverview>(`/tracker/${ws}/overview`),
  updateSettings: async (ws: string, body: Partial<TrackerSettings>) => (await api.patch<TrackerSettings>(`/tracker/${ws}/settings`, body)).data,
  acceptConsent: (ws: string, version: string) => post<{ version: string; acceptedAt: string }>(`/tracker/${ws}/consent`, { version }),
  pairCode: (ws: string) => post<{ code: string; expiresAt: string }>(`/tracker/${ws}/pair-codes`),
  devices: (ws: string) => get<TrackerDevice[]>(`/tracker/${ws}/devices`),
  revokeDevice: async (id: number) => (await api.delete(`/tracker/devices/${id}`)).data,
  live: (ws: string) => get<TrackerLiveRow[]>(`/tracker/${ws}/live?${qs({ offset: offset() })}`),
  timesheet: (ws: string, from: Date, to: Date, userId?: number) => get<TrackerTimesheetRow[]>(`/tracker/${ws}/timesheet?${qs({ from: from.toISOString(), to: to.toISOString(), offset: offset(), userId })}`),
  day: (ws: string, from: Date, to: Date, userId?: number) => get<TrackerDay>(`/tracker/${ws}/day?${qs({ from: from.toISOString(), to: to.toISOString(), userId })}`),
  apps: (ws: string, from: Date, to: Date, userId?: number) => get<{ apps: { app: string; seconds: number }[]; urls: { url: string; seconds: number }[] }>(`/tracker/${ws}/apps?${qs({ from: from.toISOString(), to: to.toISOString(), userId })}`),
  attendance: (ws: string, from: Date, to: Date, userId?: number) => get<{ dayStart: string; rows: TrackerAttendanceRow[] }>(`/tracker/${ws}/attendance?${qs({ from: from.toISOString(), to: to.toISOString(), offset: offset(), userId })}`),
  deleteShot: async (id: number) => (await api.delete<{ ok: boolean; removedShots: number }>(`/tracker/shots/${id}`)).data,
  hideShot: (id: number, hidden: boolean) => post(`/tracker/shots/${id}/hide`, { hidden }),
};

/** the consent text version the desktop app shows (keep in step with the API) */
export const CONSENT_VERSION = "2026-11-19";

export const userName = (u: Pick<TrackerUser, "firstName" | "lastName" | "email"> | null | undefined) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "Someone");
export const hm = (secs: number) => { const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; };
