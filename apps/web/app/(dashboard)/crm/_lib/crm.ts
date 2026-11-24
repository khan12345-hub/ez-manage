"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmApi, crmKeys, type CrmObject, type CrmWorkspace } from "@/services/crm.api";

/** glass surfaces used across EZ Sales */
export const glass = "rounded-[22px] border border-white/70 bg-white/72 shadow-[0_16px_44px_-28px_rgba(11,42,31,0.38)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]";
export const input = "h-9 w-full rounded-xl border border-border bg-background px-3 text-[13px] outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15";
export const btnPrimary = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground shadow-[0_8px_18px_-10px_rgba(11,42,31,0.8)] transition hover:brightness-110 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground";
export const btnGhost = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[13px] font-medium transition hover:bg-accent disabled:opacity-40";

export const OBJ: Record<CrmObject, { one: string; many: string; path: string }> = {
  contact: { one: "Contact", many: "Contacts", path: "contacts" },
  company: { one: "Company", many: "Companies", path: "companies" },
  deal: { one: "Deal", many: "Deals", path: "deals" },
};

export function useWsUid() {
  const p = useParams<{ ws: string }>();
  return p?.ws ?? "";
}

/** the open CRM workspace (members, pipelines, custom properties, my role) */
export function useCrmWs() {
  const ws = useWsUid();
  const q = useQuery({ queryKey: crmKeys.ws(ws), queryFn: () => crmApi.workspace(ws), enabled: !!ws, staleTime: 30_000 });
  return { uid: ws, ws: q.data as CrmWorkspace | undefined, isLoading: q.isLoading, isError: q.isError };
}

export const errMsg = (e: any, fallback = "Something went wrong.") => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m[0] : typeof m === "string" ? m : fallback;
};
export const onErr = (fallback?: string) => (e: unknown) => toast.error(errMsg(e, fallback));

export const fmtDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => (iso ? new Date(iso).toLocaleDateString("en-US", opts) : "");
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export const ago = (iso?: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - +new Date(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : fmtDate(iso, { month: "short", day: "numeric", year: "numeric" });
};
/** yyyy-mm-dd for <input type=date> */
export const dayInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
/** noon local so a date never jumps a day across time zones */
export const dayIso = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);
export const isPast = (iso?: string | null) => !!iso && new Date(iso) < new Date(new Date().setHours(0, 0, 0, 0));
