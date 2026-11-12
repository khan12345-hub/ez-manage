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
  id: string; kind: "message" | "assign_task"; status: "pending" | "running" | "done" | "failed" | "cancelled"; createdAt: string; decidedAt: string | null;
  payload: any; result: any;
}
export interface CeoAiTurn { conversationId: string; reply: string; used: string[]; actions: CeoAiAction[] }
export interface CeoAiConversation { id: string; title: string | null; messages: { role: "user" | "assistant"; text: string }[]; actions: CeoAiAction[] }

export const ceoApi = {
  aiStatus: async () => (await api.get<{ configured: boolean; model: string }>("/ceo-tower/ai/status")).data,
  aiChat: async (message: string, conversationId?: string | null) => (await api.post<CeoAiTurn>("/ceo-tower/ai/chat", { message, ...(conversationId ? { conversationId } : {}) }, { timeout: 180_000 })).data,
  aiConversations: async () => (await api.get<{ id: string; title: string | null; updatedAt: string }[]>("/ceo-tower/ai/conversations")).data,
  aiConversation: async (id: string) => (await api.get<CeoAiConversation>(`/ceo-tower/ai/conversations/${id}`)).data,
  aiDecide: async (id: string, confirm: boolean) => (await api.post<CeoAiAction>(`/ceo-tower/ai/actions/${id}/${confirm ? "confirm" : "cancel"}`)).data,
  person: async (id: number) => (await api.get<CeoPersonDetail>(`/ceo-tower/people/${id}`)).data,
  forYou: async () => (await api.get<{ count: number; items: CeoForYouItem[] }>("/ceo-tower/for-you")).data,
  markForYouRead: async (source: "boards" | "work", id: string) => (await api.post("/ceo-tower/for-you/read", { source, id })).data,
  tasks: async (o: { source: CeoSource; company?: string | null; person?: number | null; state: CeoTaskState; q?: string }) =>
    (await api.get<CeoTasks>(`/ceo-tower/tasks?${new URLSearchParams(Object.entries({ ...o, company: o.company ?? "", person: o.person ? String(o.person) : "" }).filter(([, v]) => v !== "" && v != null) as [string, string][])}`)).data,
  access: async () => (await api.get<{ allowed: boolean; boards: number; work: number }>("/ceo-tower/access")).data,
  overview: async (source: CeoSource, company?: string | null) =>
    (await api.get<CeoOverview>(`/ceo-tower/overview?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
};

/** may this person open CEO Tower? (owners of at least one Boards or Work workspace) */
export function useCeoAccess() {
  const q = useQuery({ queryKey: ["ceo-tower", "access"], queryFn: ceoApi.access, staleTime: 5 * 60_000, retry: false });
  return { allowed: !!q.data?.allowed, loading: q.isLoading };
}
