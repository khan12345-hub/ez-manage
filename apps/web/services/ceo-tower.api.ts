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

export const ceoApi = {
  access: async () => (await api.get<{ allowed: boolean; boards: number; work: number }>("/ceo-tower/access")).data,
  overview: async (source: CeoSource, company?: string | null) =>
    (await api.get<CeoOverview>(`/ceo-tower/overview?${new URLSearchParams({ source, ...(company ? { company } : {}) })}`)).data,
};

/** may this person open CEO Tower? (owners of at least one Boards or Work workspace) */
export function useCeoAccess() {
  const q = useQuery({ queryKey: ["ceo-tower", "access"], queryFn: ceoApi.access, staleTime: 5 * 60_000, retry: false });
  return { allowed: !!q.data?.allowed, loading: q.isLoading };
}
