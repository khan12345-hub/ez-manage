import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** CEO Tower: read-only view across the Boards and Work companies a person owns */
export type CeoSource = "all" | "boards" | "work";
export type CeoPerson = { id: number; firstName: string; lastName: string; avatarUrl: string | null };
export type CeoStats = { total: number; open: number; done: number; inProgress: number; overdue: number; doneWeek: number; progress: number };
export type CeoHealth = "healthy" | "attention" | "critical";
export interface CeoCompany { source: "boards" | "work"; key: string; id: number; uid: string; name: string; stats: CeoStats; health: CeoHealth; people: number; admins: number[] }
export interface CeoOverview {
  source: CeoSource;
  company: string | null;
  owned: { boards: number; work: number };
  kpis: CeoStats & { companies: number; people: number; unassigned: number };
  companies: CeoCompany[];
  people: { user: CeoPerson; stats: CeoStats; companies: { key: string; name: string; source: "boards" | "work" }[]; memberOf: number }[];
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
export interface CeoTasks { state: CeoTaskState; counts: Record<CeoTaskState, number>; total: number; truncated: boolean; tasks: CeoTask[] }

export type CeoForYouKind = "assigned" | "mention" | "reply" | "comment" | "message";
export interface CeoForYouItem { source: "boards" | "work"; id: string; kind: CeoForYouKind; title: string; message: string; at: string; href: string | null; actor: string | null }

export interface CeoPersonDetail {
  user: CeoPerson & { email: string }; title: string | null; isMe: boolean;
  memberships: { key: string; source: "boards" | "work"; name: string; uid: string; role: string }[];
  reach: { key: string; uid: string; name: string }[];
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
  audiences: async () => (await api.get<CeoAudiences>("/ceo-tower/audiences")).data,
  meetings: async (when: "upcoming" | "past") => (await api.get<CeoMeeting[]>(`/ceo-tower/meetings?when=${when}`)).data,
  createMeeting: async (b: { title: string; description?: string; meetingLink?: string; scheduledAt: string; attendeeIds: number[] }) => (await api.post<CeoMeeting>("/ceo-tower/meetings", b)).data,
  updateMeeting: async (id: number, b: { title?: string; description?: string | null; meetingLink?: string | null; scheduledAt?: string; attendeeIds?: number[] }) => (await api.patch<CeoMeeting>(`/ceo-tower/meetings/${id}`, b)).data,
  cancelMeeting: async (id: number) => (await api.post(`/ceo-tower/meetings/${id}/cancel`)).data,
  email: async (b: { recipientIds: number[]; subject: string; body: string }) => (await api.post<CeoEmailResult>("/ceo-tower/email", b, { timeout: 180_000 })).data,
  emailHistory: async () => (await api.get<CeoEmailRow[]>("/ceo-tower/email/history")).data,
  aiStatus: async () => (await api.get<{ configured: boolean; model: string }>("/ceo-tower/ai/status")).data,
  aiChat: async (message: string, conversationId?: string | null) => (await api.post<CeoAiTurn>("/ceo-tower/ai/chat", { message, ...(conversationId ? { conversationId } : {}) }, { timeout: 180_000 })).data,
  aiConversations: async () => (await api.get<{ id: string; title: string | null; updatedAt: string }[]>("/ceo-tower/ai/conversations")).data,
  aiConversation: async (id: string) => (await api.get<CeoAiConversation>(`/ceo-tower/ai/conversations/${id}`)).data,
  aiDecide: async (id: string, confirm: boolean) => (await api.post<CeoAiAction>(`/ceo-tower/ai/actions/${id}/${confirm ? "confirm" : "cancel"}`)).data,
  person: async (id: number) => (await api.get<CeoPersonDetail>(`/ceo-tower/people/${id}`)).data,
  forYou: async () => (await api.get<{ count: number; items: CeoForYouItem[] }>("/ceo-tower/for-you")).data,
  markForYouRead: async (source: "boards" | "work", id: string) => (await api.post("/ceo-tower/for-you/read", { source, id })).data,
  tasks: async (o: { source: CeoSource; company?: string | null; person?: number | null; state: CeoTaskState; q?: string; place?: CeoPlace | null }) => {
    const { place, ...rest } = o;
    const params = { ...rest, company: o.company ?? "", person: o.person ? String(o.person) : "", placeType: place?.type ?? "", placeId: place ? String(place.id) : "" };
    return (await api.get<CeoTasks>(`/ceo-tower/tasks?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null) as [string, string][])}`)).data;
  },
  team: async (source: CeoSource, company?: string | null) => (await api.get<CeoTeamRow[]>(`/ceo-tower/team?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
  personReport: async (id: number, days = 7) => (await api.get<CeoPersonReport>(`/ceo-tower/people/${id}/report?days=${days}`)).data,
  structure: async (product: "boards" | "work", company?: string | null) => (await api.get<any[]>(`/ceo-tower/structure?${new URLSearchParams({ product, ...(company ? { company } : {}) })}`)).data,
  access: async () => (await api.get<{ allowed: boolean; boards: number; work: number }>("/ceo-tower/access")).data,
  overview: async (source: CeoSource, company?: string | null) =>
    (await api.get<CeoOverview>(`/ceo-tower/overview?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
};

/** may this person open CEO Tower? (owners of at least one Boards or Work workspace) */
export function useCeoAccess() {
  const q = useQuery({ queryKey: ["ceo-tower", "access"], queryFn: ceoApi.access, staleTime: 5 * 60_000, retry: false });
  return { allowed: !!q.data?.allowed, loading: q.isLoading };
}
