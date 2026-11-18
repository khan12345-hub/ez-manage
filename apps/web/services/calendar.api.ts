import { api } from "@/lib/api";

export type CalAccount = { id: number; provider: "google"; email: string; color: string; enabled: boolean; createdAt: string };
export type CalEvent = {
  id: string; source: "google" | "ezmanage"; accountId: number | null; accountEmail: string | null; color: string;
  calendarName: string; title: string; start: string; end: string; allDay: boolean; location: string | null;
  meetLink: string | null; htmlLink: string | null; attendees: number; status: string;
};

/** CEO Tower calendar: read-only Google accounts (several per person) + CEO Tower meetings */
export const calendarApi = {
  accounts: async () => (await api.get<{ configured: boolean; accounts: CalAccount[] }>("/calendar/accounts")).data,
  connect: async () => (await api.get<{ configured: boolean; url: string | null }>("/calendar/google/connect")).data,
  update: async (id: number, b: { enabled?: boolean; color?: string }) => (await api.patch<CalAccount>(`/calendar/accounts/${id}`, b)).data,
  remove: async (id: number) => (await api.delete(`/calendar/accounts/${id}`)).data,
  events: async (from: Date, to: Date) => (await api.get<{ configured: boolean; events: CalEvent[]; errors: { accountId: number; email: string; reconnect: boolean }[] }>(`/calendar/events?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })}`)).data,
};
