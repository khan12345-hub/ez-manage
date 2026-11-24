/*
 * EZ CRM API client (5th product). Kept apart from Boards and Work.
 * (To be moved to apps/web/products/crm/ in the repo-wide reorganisation.)
 */
import { api } from "@/lib/api";

export type CrmRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type CrmObject = "contact" | "company" | "deal";
export type CrmUser = { id: number; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null };
export type CrmStage = { id: number; name: string; position: number; probability: number; isWon: boolean; isLost: boolean };
export type CrmPipeline = { id: number; name: string; position: number; stages: CrmStage[] };
export type CrmPropType = "text" | "number" | "date" | "select" | "multiselect" | "bool" | "url";
export type CrmProperty = { id: number; object: CrmObject; key: string; label: string; type: CrmPropType; options: string[]; position: number };
export type CrmWorkspaceRow = { id: number; uid: string; name: string; currency: string; role: CrmRole; contacts: number; openDeals: number; pipelineValue: number };
export type CrmInvite = { id: number; email: string; role: CrmRole; createdAt: string };
export type CrmWorkspace = { id: number; uid: string; name: string; currency: string; ownerId: number; role: CrmRole; canEdit: boolean; canAdmin: boolean; members: { role: CrmRole; joinedAt: string; user: CrmUser }[]; invites?: CrmInvite[]; pipelines: CrmPipeline[]; properties: CrmProperty[] };

export const LIFECYCLES = ["subscriber", "lead", "mql", "sql", "opportunity", "customer", "evangelist", "other"] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];
export const LIFECYCLE_LABEL: Record<Lifecycle, string> = { subscriber: "Subscriber", lead: "Lead", mql: "Marketing qualified", sql: "Sales qualified", opportunity: "Opportunity", customer: "Customer", evangelist: "Evangelist", other: "Other" };
export const LEAD_STATUSES = ["new", "open", "in_progress", "attempted", "connected", "unqualified", "bad_timing"] as const;
export const LEAD_STATUS_LABEL: Record<(typeof LEAD_STATUSES)[number], string> = { new: "New", open: "Open", in_progress: "In progress", attempted: "Attempted to contact", connected: "Connected", unqualified: "Unqualified", bad_timing: "Bad timing" };

export type CrmCompany = { id: number; name: string; domain: string | null; industry: string | null; size: string | null; phone: string | null; city: string | null; country: string | null; ownerId: number | null; owner: CrmUser | null; custom: Record<string, unknown>; createdAt: string; updatedAt: string; lastActivityAt: string | null; contacts?: number; deals?: number; openValue?: number };
export type CrmContact = { id: number; firstName: string; lastName: string; email: string | null; phone: string | null; title: string | null; companyId: number | null; company: { id: number; name: string } | null; ownerId: number | null; owner: CrmUser | null; lifecycle: Lifecycle; leadStatus: string | null; source: string | null; custom: Record<string, unknown>; createdAt: string; updatedAt: string; lastActivityAt: string | null; deals?: number };
export type CrmDeal = { id: number; name: string; amount: number; currency: string | null; pipelineId: number; stageId: number; stage: { id: number; name: string; probability: number; isWon: boolean; isLost: boolean }; closeDate: string | null; ownerId: number | null; owner: CrmUser | null; priority: "low" | "medium" | "high" | null; companyId: number | null; company: { id: number; name: string } | null; contacts: { id: number; firstName: string; lastName: string; email: string | null }[]; custom: Record<string, unknown>; position: number; wonAt: string | null; lostAt: string | null; lostReason: string | null; createdAt: string; updatedAt: string; lastActivityAt: string | null };
export type CrmActivityKind = "note" | "call" | "meeting" | "email_log" | "task" | "event";
export type CrmActivity = { id: number; kind: CrmActivityKind; subject: string | null; body: string | null; dueAt: string | null; doneAt: string | null; outcome: string | null; durationMin: number | null; ownerId: number; owner: CrmUser | null; assigneeId: number | null; assignee: CrmUser | null; contactId: number | null; companyId: number | null; dealId: number | null; contact?: { id: number; firstName: string; lastName: string } | null; company?: { id: number; name: string } | null; deal?: { id: number; name: string } | null; meta: Record<string, any> | null; createdAt: string };
export type Page<T> = { total: number; page: number; pageSize: number; rows: T[] };
export type CrmHome = {
  currency: string; pipelines: { id: number; name: string }[]; pipelineId: number | null;
  kpis: { pipelineValue: number; weighted: number; openDeals: number; wonMonth: number; wonMonthCount: number; winRate: number | null; newContacts: number; contacts: number; myOverdue: number };
  stages: { id: number; name: string; probability: number; isWon: boolean; isLost: boolean; count: number; amount: number; weighted: number }[];
  myTasks: CrmActivity[]; closing: (CrmDeal & { stage: { name: string; probability: number } })[]; recent: CrmActivity[];
  leaderboard: { user: CrmUser | null; won: number; wonCount: number; pipeline: number }[];
};
export type ListQuery = Record<string, string | number | undefined | null>;

const qs = (q: ListQuery = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
const get = async <T,>(u: string) => (await api.get<T>(u)).data;
const post = async <T,>(u: string, b?: unknown) => (await api.post<T>(u, b)).data;
const patch = async <T,>(u: string, b?: unknown) => (await api.patch<T>(u, b)).data;
const put = async <T,>(u: string, b?: unknown) => (await api.put<T>(u, b)).data;
const del = async <T,>(u: string) => (await api.delete<T>(u)).data;
const W = (ws: string) => `/crm/workspaces/${ws}`;
const plural = (o: CrmObject) => (o === "company" ? "companies" : `${o}s`);

export const crmKeys = {
  all: ["crm"] as const,
  ws: (ws: string) => ["crm", "ws", ws] as const,
  list: (ws: string, o: CrmObject, q?: ListQuery) => ["crm", ws, "list", o, q ?? {}] as const,
  record: (ws: string, o: CrmObject, id: number) => ["crm", ws, "record", o, id] as const,
  timeline: (ws: string, o: CrmObject, id: number) => ["crm", ws, "timeline", o, id] as const,
  home: (ws: string, pipelineId?: number | null) => ["crm", ws, "home", pipelineId ?? null] as const,
  tasks: (ws: string, q?: ListQuery) => ["crm", ws, "tasks", q ?? {}] as const,
  views: (ws: string, o: CrmObject) => ["crm", ws, "views", o] as const,
};

export const crmApi = {
  workspaces: () => get<{ canCreate: boolean; workspaces: CrmWorkspaceRow[] }>(`/crm/workspaces`),
  createWorkspace: (b: { name: string; currency?: string }) => post<{ uid: string; name: string }>(`/crm/workspaces`, b),
  workspace: (ws: string) => get<CrmWorkspace>(W(ws)),
  updateWorkspace: (ws: string, b: { name?: string; currency?: string }) => patch(W(ws), b),
  deleteWorkspace: (ws: string) => del(W(ws)),
  addMember: (ws: string, b: { email: string; role: CrmRole }) => post<{ invited: boolean; email?: string }>(`${W(ws)}/members`, b),
  updateMember: (ws: string, userId: number, role: CrmRole) => patch(`${W(ws)}/members/${userId}`, { role }),
  removeMember: (ws: string, userId: number) => del(`${W(ws)}/members/${userId}`),
  cancelInvite: (ws: string, id: number) => del(`${W(ws)}/invites/${id}`),
  createPipeline: (ws: string, b: { name: string; stages?: Partial<CrmStage>[] }) => post<CrmPipeline[]>(`${W(ws)}/pipelines`, b),
  updatePipeline: (ws: string, id: number, b: { name: string; stages?: { id?: number; name: string; probability: number; isWon?: boolean; isLost?: boolean }[] }) => put<CrmPipeline[]>(`${W(ws)}/pipelines/${id}`, b),
  deletePipeline: (ws: string, id: number) => del<CrmPipeline[]>(`${W(ws)}/pipelines/${id}`),
  createProperty: (ws: string, b: { object: CrmObject; label: string; type: CrmPropType; options?: string[] }) => post<CrmProperty>(`${W(ws)}/properties`, b),
  updateProperty: (ws: string, id: number, b: { label?: string; options?: string[] }) => patch<CrmProperty>(`${W(ws)}/properties/${id}`, b),
  deleteProperty: (ws: string, id: number) => del(`${W(ws)}/properties/${id}`),
  views: (ws: string, object: CrmObject) => get<{ id: number; name: string; settings: Record<string, any> }[]>(`${W(ws)}/views?object=${object}`),
  createView: (ws: string, b: { object: CrmObject; name: string; settings: Record<string, unknown> }) => post<{ id: number }>(`${W(ws)}/views`, b),
  updateView: (ws: string, id: number, b: { name?: string; settings?: Record<string, unknown> }) => patch(`${W(ws)}/views/${id}`, b),
  deleteView: (ws: string, id: number) => del(`${W(ws)}/views/${id}`),

  home: (ws: string, pipelineId?: number | null) => get<CrmHome>(`${W(ws)}/home${qs({ pipelineId })}`),
  search: (ws: string, q: string) => get<{ contacts: { id: number; firstName: string; lastName: string; email: string | null }[]; companies: { id: number; name: string; domain: string | null }[]; deals: { id: number; name: string; amount: number }[] }>(`${W(ws)}/search${qs({ q })}`),
  tasks: (ws: string, q: ListQuery) => get<{ counts: { overdue: number; today: number; open: number }; rows: CrmActivity[] }>(`${W(ws)}/tasks${qs(q)}`),

  list: <T,>(ws: string, o: CrmObject, q: ListQuery) => get<Page<T>>(`${W(ws)}/${plural(o)}${qs(q)}`),
  record: <T,>(ws: string, o: CrmObject, id: number) => get<T>(`${W(ws)}/${plural(o)}/${id}`),
  create: <T,>(ws: string, o: CrmObject, b: Record<string, unknown>) => post<T>(`${W(ws)}/${plural(o)}`, b),
  update: <T,>(ws: string, o: CrmObject, id: number, b: Record<string, unknown>) => patch<T>(`${W(ws)}/${plural(o)}/${id}`, b),
  remove: (ws: string, o: CrmObject, id: number) => del(`${W(ws)}/${plural(o)}/${id}`),
  moveDeal: (ws: string, id: number, b: { stageId: number; beforeId?: number | null; lostReason?: string }) => post(`${W(ws)}/deals/${id}/move`, b),
  linkContact: (ws: string, dealId: number, contactId: number, on: boolean) => (on ? put(`${W(ws)}/deals/${dealId}/contacts/${contactId}`) : del(`${W(ws)}/deals/${dealId}/contacts/${contactId}`)),
  bulk: (ws: string, b: { object: CrmObject; ids: number[]; action: "delete" | "owner" | "lifecycle" | "stage"; ownerId?: number | null; lifecycle?: string; stageId?: number }) => post<{ ok: true; count: number }>(`${W(ws)}/bulk`, b),

  timeline: (ws: string, o: CrmObject, id: number) => get<CrmActivity[]>(`${W(ws)}/${plural(o)}/${id}/timeline`),
  createActivity: (ws: string, b: Record<string, unknown>) => post<CrmActivity>(`${W(ws)}/activities`, b),
  updateActivity: (ws: string, id: number, b: Record<string, unknown>) => patch<CrmActivity>(`${W(ws)}/activities/${id}`, b),
  deleteActivity: (ws: string, id: number) => del(`${W(ws)}/activities/${id}`),

  notifications: () => get<{ unread: number; items: { id: string; title: string; message: string; isRead: boolean; createdAt: string; metadata: { href?: string } | null }[] }>(`/crm/notifications`),
  readNotifications: () => post(`/crm/notifications/read`),
};

export const userName = (u?: Pick<CrmUser, "firstName" | "lastName" | "email"> | null) => (u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email : "");
export const contactName = (c?: { firstName: string; lastName: string } | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "");
export const fmtMoney = (n: number, currency = "USD", compact = false) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: compact || n >= 1000 ? 0 : 2, ...(compact && { notation: "compact" as const }) }).format(n); }
  catch { return `${currency} ${n.toLocaleString()}`; }
};
