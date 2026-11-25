/*
 * EZ Tracker API client (time, screenshots and activity from the desktop app).
 * A company lives in Company Work ("w-<uid>") or Accounts & Invoices ("b-<uid>"); kept apart from the other products.
 */
import { api } from "@/lib/api";

export type TrackerUser = { id: number; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
export type TrackerSettings = {
  screenshotsPer10: number; blur: boolean; trackApps: boolean; trackUrls: boolean; idleMinutes: number;
  retentionDays: number; dayStart: string;
};
export type TrackerSource = "work" | "boards";
/** manager = system Administrator or Tracker admin there (product roles do not count) */
export type TrackerWorkspace = { id: number; uid: string; name: string; color: string; role: string | null; source: TrackerSource; key: string; manager: boolean };
export type TrackerTask = { id: number; uid: string | null; name: string; source: TrackerSource; boardUid?: string | null };
export type TrackerOverview = {
  workspace: { uid: string; name: string; color: string; source: TrackerSource; key: string } | null; role: string; isManager: boolean; isSystemAdmin: boolean; member: boolean; canSeeOthers: boolean;
  settings: TrackerSettings; tracked: boolean; consent: { version: string; acceptedAt: string | null }; devices: number; isAdmin?: boolean;
};
export type TrackerLiveRow = {
  user: TrackerUser; me: boolean; status: "working" | "away" | "offline"; since: string | null; awaySince: string | null;
  task: TrackerTask | null; project: string | null;
  todaySeconds: number; todayActivity: number; lastShot: { url: string | null; takenAt: string; blurred: boolean } | null;
};
export type TrackerTimesheetRow = { user: TrackerUser; total: number; activeTotal: number; days: Record<string, { seconds: number; active: number; activity: number }>; tasks: { name: string; uid: string | null; seconds: number }[] };
export type TrackerShot = { id: number; url: string | null; takenAt: string; blurred: boolean; screen: number; hiddenAt: string | null };
export type TrackerSlot = {
  id: number; start: string; seconds: number; keyboard: number; mouse: number; activityPct: number; idleDiscarded: boolean; away: boolean;
  task: TrackerTask | null; project: string | null; shots: TrackerShot[];
  apps: { app: string; title: string | null; url: string | null; seconds: number }[];
};
export type TrackerDay = { user: TrackerUser | null; own: boolean; canHide: boolean; canSeeScreens: boolean; slots: TrackerSlot[]; totalSeconds: number };
export type TrackerAttendanceRow = { user: TrackerUser; day: string; firstStart: string; lastEnd: string | null; seconds: number; late: boolean; lateMinutes: number };
export type TrackerCompanyLive = { company: { key: string; name: string; source: TrackerSource; color: string }; working: TrackerLiveRow[]; people: number; todaySeconds: number };
export type TrackerPerson = {
  user: TrackerUser; company: { key: string; name: string; source: TrackerSource } | null; role: "member" | "admin"; addedAt: string;
  devices: { id: number; name: string; os: string | null; lastSeenAt: string | null; createdAt: string }[]; installed: boolean; lastSeenAt: string | null;
  consent: { state: "agreed" | "outdated" | "never"; at: string | null }; tracked: boolean; trackerAdmin: boolean;
  todaySeconds: number; lastActiveAt: string | null; lastRemindedAt: string | null;
};
export type TrackerDevice = { id: number; name: string; os: string | null; appVersion: string | null; lastSeenAt: string | null; createdAt: string };
export type TrackerPeriod = { tracked: number; active: number };
export type TrackerPersonDetail = {
  user: TrackerUser & { phone: string | null; jobTitle: string | null; systemRole: string };
  member: { role: "member" | "admin"; tracking: boolean; addedAt: string; addedBy: TrackerUser | null };
  devices: TrackerDevice[]; installed: boolean;
  consent: { version: string; state: "agreed" | "outdated" | "never"; acceptedAt: string | null; history: { version: string; acceptedAt: string }[] };
  periods: { day: TrackerPeriod; week: TrackerPeriod; month: TrackerPeriod };
  days: { day: string; tracked: number; active: number; activity: number }[];
  idleMinutes: number; canSeeScreens: boolean;
};

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
  connect: (nonce: string) => post<{ ok: true }>(`/tracker/connect`, { nonce }),
  deployCodes: (ws: string) => get<{ id: number; org: boolean; user: TrackerUser | null; lastUsedAt: string | null; createdAt: string }[]>(`/tracker/${ws}/deploy-codes`),
  /** userId → per-person code; omit it → an organisation token (assign devices later) */
  createDeployCode: (ws: string, userId?: number) => post<{ code: string }>(`/tracker/${ws}/deploy-codes`, userId ? { userId } : {}),
  revokeDeployCode: async (ws: string, id: number) => (await api.delete(`/tracker/${ws}/deploy-codes/${id}`)).data,
  unassignedDevices: (ws: string) => get<{ id: number; name: string; os: string | null; appVersion: string | null; lastSeenAt: string | null; createdAt: string }[]>(`/tracker/${ws}/unassigned`),
  assignDevice: (ws: string, id: number, userId: number) => post<{ ok: true }>(`/tracker/${ws}/devices/${id}/assign`, { userId }),
  teamOf: (ws: string, managerId: number) => get<number[]>(`/tracker/${ws}/people/${managerId}/team`),
  setTeam: async (ws: string, managerId: number, memberIds: number[]) => (await api.put<{ managed: number[] }>(`/tracker/${ws}/people/${managerId}/team`, { memberIds })).data,
  devices: (ws: string) => get<TrackerDevice[]>(`/tracker/${ws}/devices`),
  revokeDevice: async (id: number) => (await api.delete(`/tracker/devices/${id}`)).data,
  liveAll: () => get<TrackerCompanyLive[]>(`/tracker/all/live?${qs({ offset: offset() })}`),
  live: (ws: string) => get<TrackerLiveRow[]>(`/tracker/${ws}/live?${qs({ offset: offset() })}`),
  timesheet: (ws: string, from: Date, to: Date, userId?: number) => get<TrackerTimesheetRow[]>(`/tracker/${ws}/timesheet?${qs({ from: from.toISOString(), to: to.toISOString(), offset: offset(), userId })}`),
  day: (ws: string, from: Date, to: Date, userId?: number) => get<TrackerDay>(`/tracker/${ws}/day?${qs({ from: from.toISOString(), to: to.toISOString(), userId })}`),
  apps: (ws: string, from: Date, to: Date, userId?: number) => get<{ apps: { app: string; seconds: number }[]; urls: { url: string; seconds: number }[] }>(`/tracker/${ws}/apps?${qs({ from: from.toISOString(), to: to.toISOString(), userId })}`),
  attendance: (ws: string, from: Date, to: Date, userId?: number) => get<{ dayStart: string; rows: TrackerAttendanceRow[] }>(`/tracker/${ws}/attendance?${qs({ from: from.toISOString(), to: to.toISOString(), offset: offset(), userId })}`),
  people: (ws: string) => get<TrackerPerson[]>(`/tracker/${ws}/people?${qs({ offset: offset() })}`),
  peopleAll: () => get<TrackerPerson[]>(`/tracker/all/people?${qs({ offset: offset() })}`),
  person: (ws: string, userId: number) => get<TrackerPersonDetail>(`/tracker/${ws}/people/${userId}?${qs({ offset: offset() })}`),
  setTracking: async (ws: string, userId: number, on: boolean) => (await api.patch(`/tracker/${ws}/people/${userId}/tracking`, { on })).data,
  remind: (ws: string, userId: number) => post<{ ok: boolean; sentAt: string }>(`/tracker/${ws}/people/${userId}/remind`),
  revokeDeviceAs: async (ws: string, id: number) => (await api.delete(`/tracker/${ws}/devices/${id}`)).data,
  /** company members not in EZ Tracker yet */
  candidates: (ws: string) => get<TrackerUser[]>(`/tracker/${ws}/candidates`),
  addPeople: (ws: string, body: { userIds?: number[]; emails?: string[]; role?: "member" | "admin" }) => post<{ added: number; people: TrackerPerson[] }>(`/tracker/${ws}/people`, body),
  removePerson: async (ws: string, userId: number) => (await api.delete(`/tracker/${ws}/people/${userId}`)).data,
  setRole: async (ws: string, userId: number, role: "member" | "admin") => (await api.patch(`/tracker/${ws}/people/${userId}/role`, { role })).data,
  deleteShot: async (id: number) => (await api.delete<{ ok: boolean; removedShots: number }>(`/tracker/shots/${id}`)).data,
  hideShot: (id: number, hidden: boolean) => post(`/tracker/shots/${id}/hide`, { hidden }),
};

/** the consent text version the desktop app shows (keep in step with the API) */
export const CONSENT_VERSION = "2026-11-19.2";

export const userName = (u: Pick<TrackerUser, "firstName" | "lastName" | "email"> | null | undefined) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "Someone");
export const hm = (secs: number) => { const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; };

/** product labels for the company picker */
export const SOURCE_LABEL: Record<TrackerSource, string> = { work: "Company Work", boards: "Accounts & Invoices" };
