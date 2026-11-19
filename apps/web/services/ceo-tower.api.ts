import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** CEO Tower: read-only view across the Boards and Work companies a person owns */
export type CeoSource = "all" | "boards" | "work";
export type CeoPerson = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
export type CeoStats = { total: number; open: number; done: number; inProgress: number; overdue: number; doneWeek: number; progress: number };
export type CeoHealth = "healthy" | "attention" | "critical";
export interface CeoCompany { source: "boards" | "work"; key: string; id: number; uid: string; name: string; stats: CeoStats; health: CeoHealth; people: number; admins: number[]; leads?: string[] }
export interface CeoOverview {
  source: CeoSource;
  company: string | null;
  owned: { boards: number; work: number };
  kpis: CeoStats & { companies: number; people: number; unassigned: number };
  /** everything the CEO gave out */
  ceoTasks: CeoStats;
  companies: CeoCompany[];
  people: { user: CeoPerson; stats: CeoStats; fromCeo: number; companies: { key: string; name: string; source: "boards" | "work" }[]; memberOf: number }[];
  updates: { kind: "done"; source: "boards" | "work"; task: { id: number; uid: string; name: string }; where: string; company?: string; at: string; people: string[] }[];
  attention: {
    companies: { key: string; name: string; source: "boards" | "work"; overdue: number }[];
    overdue: { source: "boards" | "work"; task: { id: number; uid: string; name: string }; where: string; company?: string; due: string; people: string[] }[];
  };
}

export type CeoTaskState = "open" | "in_progress" | "overdue" | "due_week" | "done_week" | "unassigned" | "all";
export interface CeoTask {
  source: "boards" | "work"; id: number; uid: string; name: string; where: string;
  company: { key: string; name: string; source: "boards" | "work"; uid: string };
  due: string | null; done: boolean; active: boolean; overdue: boolean; doneAt: string | null;
  status: { label: string; color: string } | null; priority: string | null; href: string; assignees: CeoPerson[];
}
export interface CeoTaskDetail {
  source: "boards" | "work"; id: number; uid: string; name: string; description: string | null;
  company: { key: string; name: string }; where: string; href: string;
  status: { id: number | null; label: string; color: string; category: string | null } | null;
  statuses: { id: number; label: string; color: string; category: string }[];
  priority: string | null; due: string | null; done: boolean; createdAt: string;
  createdBy: CeoPerson | null; assignees: CeoPerson[];
  people: CeoPerson[]; editable: { due: boolean; people: boolean; priority: boolean };
  comments: { id: number; parentId: number | null; user: CeoPerson | null; text: string; createdAt: string; files: { name: string; mime: string; url: string }[] }[];
}
export interface CeoCompanyPeople {
  source: "boards" | "work"; key: string; id: number; uid: string; name: string; canManage: boolean; roles: string[];
  boards: { id: number; name: string }[];
  members: { memberId: number; role: string; since: string; user: CeoPerson & { email: string } }[];
  invites: { id: number; email: string; role: string; createdAt: string }[];
}
export type CeoMgmtPerson = { user: CeoPerson & { email: string }; title: string | null; roles: { company: { key: string; name: string; source: "boards" | "work"; uid: string }; role: string }[]; stats: CeoStats; fromCeo: number };
export interface CeoManagement {
  managers: (CeoMgmtPerson & { reports: (CeoMgmtPerson & { company: { key: string; name: string; source: "boards" | "work"; uid: string } })[]; team: { open: number; overdue: number; inProgress: number; doneWeek: number } })[];
  unmanaged: CeoMgmtPerson[];
  /** per company (Work and Boards): who is in it, who they report to, and whether you can change it */
  work: { company: { key: string; name: string; source: "boards" | "work"; uid: string }; canSet: boolean; members: { userId: number; managerId: number | null }[] }[];
  counts: { managers: number; people: number; unmanaged: number };
}
export type CeoTrends = { weeks: { start: string; created: number; completed: number }[]; days: { day: string; open: number; overdue: number; done: number }[] };
export type CeoSettings = { briefOn: boolean; briefEmail: boolean; briefHour: number; timezone: string; alertsOn: boolean; lastBriefOn: string | null };
export type CeoBrief = { generatedAt: string; by: "claude" | "groq" | "summary"; bullets: string[] };
export interface CeoTasks { state: CeoTaskState; counts: Record<CeoTaskState, number>; total: number; truncated: boolean; tasks: CeoTask[] }

export type CeoForYouKind = "assigned" | "mention" | "reply" | "comment" | "message" | "completed";
export interface CeoMini { id: number; firstName: string | null; lastName: string | null; avatarUrl: string | null }
export interface CeoAssignedTask {
  /** which product it lives in (Accounts & Invoices items are "boards") */
  source?: "work" | "boards";
  id: number; uid: string; name: string; priority: string | null; dueDate: string | null; completedAt: string | null; createdAt: string; overdue: boolean;
  status: { name: string; color: string; category: string } | null; company: { key: string; uid: string; name: string }; where: string; listUid: string;
  channel: { uid: string; name: string } | null; assignees: CeoMini[]; completedBy: CeoMini | null; hoursToDone: number | null;
}
export interface CeoAssigned {
  summary: { total: number; open: number; done: number; overdue: number; doneWeek: number };
  people: { user: CeoMini; assigned: number; open: number; done: number; overdue: number; avgHoursToDone: number | null }[];
  tasks: CeoAssignedTask[]; companies?: { key: string; name: string }[];
}
export interface CeoChannelGroup {
  company: { key: string; uid: string; name: string; id?: number; source?: "work" | "boards" };
  channels: { uid: string; id?: number; name: string | null; kind: "channel" | "dm" | "group"; isPrivate: boolean; lastMessageAt: string | null; memberCount: number; people: CeoMini[]; unread: boolean; openTasks: number }[];
}
export interface CeoForYouItem { source: "boards" | "work"; id: string; kind: CeoForYouKind; title: string; message: string; at: string; href: string | null; actor: string | null; approval?: boolean;
  /** answer in place: the task's thread, or a message back to the sender */
  task: { source: "boards" | "work"; id: number } | null; actorId: number | null }

export interface CeoPersonDetail {
  user: CeoPerson & { email: string }; title: string | null; isMe: boolean;
  memberships: { key: string; source: "boards" | "work"; name: string; uid: string; role: string }[];
  reach: { key: string; uid: string; name: string }[];
  /** Boards companies where a Boards chat DM reaches them (people only in Boards) */
  boardsReach: { key: string; id: number; uid: string; name: string }[];
}

export interface CeoAiAction {
  id: string; kind: "message" | "assign_task" | "email" | "meeting"; status: "pending" | "running" | "done" | "failed" | "cancelled"; createdAt: string; decidedAt: string | null;
  payload: any; result: any;
}
export interface CeoAiTurn { conversationId: string; reply: string; used: string[]; actions: CeoAiAction[] }
export interface CeoAiConversation { id: string; title: string | null; messages: { role: "user" | "assistant"; text: string }[]; actions: CeoAiAction[] }

export type CeoPlace = { type: "space" | "folder" | "list" | "board"; id: number; name: string };
export interface CeoTeamRow {
  user: CeoPerson; title: string | null; manager: { id: number; name: string | null } | null; reports: number;
  memberships: { key: string; source: "boards" | "work"; name: string; role: string }[]; stats: CeoStats; lastActive: string | null;
}
export interface CeoPersonReport extends CeoPersonDetail {
  days: number; counts: { open: number; inProgress: number; overdue: number; doneInWindow: number };
  inProgress: CeoTask[]; overdue: CeoTask[]; dueSoon: CeoTask[]; finished: CeoTask[];
  talkingWith: { conversation: string; kind: string; messages: number; sent_by_person?: number; last_message_at: string | null }[];
  teams: string[]; directReports: number[];
}

export interface CeoAudiences {
  management: number[];
  teams: { id: number; name: string; company: string; people: number[] }[];
  companies: { key: string; name: string; source: "boards" | "work"; people: number[] }[];
}
export interface CeoMeeting {
  id: number; title: string; description: string | null; meetingLink: string | null; scheduledAt: string; cancelledAt: string | null;
  attendees: { userId: number; user: CeoPerson & { email: string } }[];
}
export interface CeoEmailRow { id: number; subject: string; body: string; deliveryStatus: string; sentAt: string; recipient: CeoPerson & { email: string } }
export interface CeoEmailResult { sent: number; failed: number; notSent: number; results: { id: number; name: string; status: "sent" | "failed" | "not_sent"; error?: string }[] }

export const ceoApi = {
  assigned: async (q: { person?: number; company?: string; state?: string } = {}) => (await api.get<CeoAssigned>(`/ceo-tower/assigned?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))}`)).data,
  channels: async () => (await api.get<CeoChannelGroup[]>(`/ceo-tower/channels`)).data,
  audiences: async () => (await api.get<CeoAudiences>("/ceo-tower/audiences")).data,
  meetings: async (when: "upcoming" | "past") => (await api.get<CeoMeeting[]>(`/ceo-tower/meetings?when=${when}`)).data,
  createMeeting: async (b: { title: string; description?: string; meetingLink?: string; scheduledAt: string; attendeeIds: number[] }) => (await api.post<CeoMeeting>("/ceo-tower/meetings", b)).data,
  updateMeeting: async (id: number, b: { title?: string; description?: string | null; meetingLink?: string | null; scheduledAt?: string; attendeeIds?: number[] }) => (await api.patch<CeoMeeting>(`/ceo-tower/meetings/${id}`, b)).data,
  cancelMeeting: async (id: number) => (await api.post(`/ceo-tower/meetings/${id}/cancel`)).data,
  email: async (b: { recipientIds: number[]; subject: string; body: string }) => (await api.post<CeoEmailResult>("/ceo-tower/email", b, { timeout: 180_000 })).data,
  emailHistory: async () => (await api.get<CeoEmailRow[]>("/ceo-tower/email/history")).data,
  aiStatus: async () => (await api.get<{ configured: boolean; provider: "claude" | "groq" | null; model: string }>("/ceo-tower/ai/status")).data,
  aiChat: async (message: string, conversationId?: string | null) => (await api.post<CeoAiTurn>("/ceo-tower/ai/chat", { message, ...(conversationId ? { conversationId } : {}) }, { timeout: 180_000 })).data,
  aiConversations: async () => (await api.get<{ id: string; title: string | null; updatedAt: string }[]>("/ceo-tower/ai/conversations")).data,
  aiConversation: async (id: string) => (await api.get<CeoAiConversation>(`/ceo-tower/ai/conversations/${id}`)).data,
  aiDecide: async (id: string, confirm: boolean) => (await api.post<CeoAiAction>(`/ceo-tower/ai/actions/${id}/${confirm ? "confirm" : "cancel"}`)).data,
  person: async (id: number) => (await api.get<CeoPersonDetail>(`/ceo-tower/people/${id}`)).data,
  message: async (personId: number, text: string, via?: string) =>
    (await api.post<{ product: "work" | "boards"; via: string; href: string }>("/ceo-tower/message", { personId, text, ...(via ? { via } : {}) })).data,
  forYou: async () => (await api.get<{ count: number; approvals?: number; items: CeoForYouItem[] }>("/ceo-tower/for-you")).data,
  markForYouRead: async (source: "boards" | "work", id: string) => (await api.post("/ceo-tower/for-you/read", { source, id })).data,
  task: async (source: "boards" | "work", id: number) => (await api.get<CeoTaskDetail>(`/ceo-tower/task/${source}/${id}`)).data,
  /** an instruction, optionally with files (a voice note is just an audio file). Work: upload to the task first, then link; Boards: one multipart call. */
  taskComment: async (source: "boards" | "work", id: number, text: string, parentId?: number, files: File[] = []) => {
    if (files.length && source === "boards") {
      const fd = new FormData();
      fd.append("text", text); if (parentId) fd.append("parentId", String(parentId));
      files.forEach((f) => fd.append("files", f));
      return (await api.post<CeoTaskDetail>(`/ceo-tower/task/boards/${id}/comment-files`, fd, { timeout: 120_000 })).data;
    }
    let attachmentIds: number[] = [];
    if (files.length) {
      const fd = new FormData(); files.forEach((f) => fd.append("files", f));
      attachmentIds = (await api.post<{ id: number }[]>(`/work/tasks/${id}/attachments?source=comment`, fd, { timeout: 120_000 })).data.map((a) => a.id);
    }
    return (await api.post<CeoTaskDetail>(`/ceo-tower/task/${source}/${id}/comment`, { text, ...(parentId ? { parentId } : {}), ...(attachmentIds.length ? { attachmentIds } : {}) })).data;
  },
  taskUpdate: async (source: "boards" | "work", id: number, dto: { due?: string | null; assigneeIds?: number[]; priority?: string | null }) => (await api.patch<CeoTaskDetail>(`/ceo-tower/task/${source}/${id}`, dto)).data,
  taskStatus: async (source: "boards" | "work", id: number, statusId?: number) => (await api.post<CeoTaskDetail>(`/ceo-tower/task/${source}/${id}/status`, statusId ? { statusId } : {})).data,
  management: async (source: CeoSource, company?: string | null) => (await api.get<CeoManagement>(`/ceo-tower/management?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
  companyPeople: async (key: string) => (await api.get<CeoCompanyPeople>(`/ceo-tower/companies/${encodeURIComponent(key)}/people`)).data,
  trends: async (source: CeoSource, company?: string | null) => (await api.get<CeoTrends>(`/ceo-tower/trends?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
  settings: async () => (await api.get<CeoSettings>("/ceo-tower/settings")).data,
  saveSettings: async (dto: Partial<CeoSettings>) => (await api.put<CeoSettings>("/ceo-tower/settings", dto)).data,
  sendBriefNow: async () => (await api.post<{ sent: boolean; day: string; bullets: string[]; emailed: string }>("/ceo-tower/brief/send", {}, { timeout: 180_000 })).data,
  brief: async (refresh = false) => (await api.get<CeoBrief>(`/ceo-tower/ai/brief${refresh ? "?refresh=1" : ""}`, { timeout: 120_000 })).data,
  tasks: async (o: { source: CeoSource; company?: string | null; person?: number | null; state: CeoTaskState; q?: string; place?: CeoPlace | null; mine?: boolean }) => {
    const { place, ...rest } = o;
    const { mine, ...restNoMine } = rest;
    const params = { ...restNoMine, company: o.company ?? "", person: o.person ? String(o.person) : "", placeType: place?.type ?? "", placeId: place ? String(place.id) : "", by: mine ? "me" : "" };
    return (await api.get<CeoTasks>(`/ceo-tower/tasks?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null) as [string, string][])}`)).data;
  },
  team: async (source: CeoSource, company?: string | null) => (await api.get<CeoTeamRow[]>(`/ceo-tower/team?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
  personReport: async (id: number, days = 7) => (await api.get<CeoPersonReport>(`/ceo-tower/people/${id}/report?days=${days}`)).data,
  structure: async (product: "boards" | "work", company?: string | null) => (await api.get<any[]>(`/ceo-tower/structure?${new URLSearchParams({ product, ...(company ? { company } : {}) })}`)).data,
  access: async () => (await api.get<CeoAccess>("/ceo-tower/access")).data,
  sharedWith: async () => (await api.get<CeoAccessGrant[]>("/ceo-tower/access/shared")).data,
  share: async (userId: number) => (await api.post<{ ok: boolean; already?: boolean }>("/ceo-tower/access/shared", { userId })).data,
  unshare: async (userId: number) => (await api.delete(`/ceo-tower/access/shared/${userId}`)).data,
  overview: async (source: CeoSource, company?: string | null) =>
    (await api.get<CeoOverview>(`/ceo-tower/overview?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
};

export type CeoAccess = { allowed: boolean; canShare: boolean; sharedBy: { id: number; name: string }[]; boards: number; work: number };
export type CeoAccessGrant = { id: number; user: { id: number; firstName: string; lastName: string; avatarUrl: string | null; email: string }; createdAt: string };

/** may this person open CEO Tower? (company owners, and people an owner shared it with) */
export function useCeoAccess() {
  const q = useQuery({ queryKey: ["ceo-tower", "access"], queryFn: ceoApi.access, staleTime: 60_000, retry: false });
  return { allowed: !!q.data?.allowed, canShare: !!q.data?.canShare, sharedBy: q.data?.sharedBy ?? [], loading: q.isLoading };
}
