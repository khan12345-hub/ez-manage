"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { trackerApi } from "@/services/tracker.api";

/** the Company Work workspace in the URL + the caller's place in EZ Tracker */
export function useTrackerWs() {
  const { ws = "" } = useParams<{ ws: string }>();
  const q = useQuery({ queryKey: ["tracker", ws, "overview"], queryFn: () => trackerApi.overview(ws), enabled: !!ws, staleTime: 30_000, retry: false });
  return { ws, ov: q.data, isLoading: q.isLoading, isError: q.isError };
}

/** local day [00:00, next 00:00) for a yyyy-mm-dd string */
export function dayRange(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const from = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1) };
}
export const todayKey = () => keyOf(new Date());
export const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const shiftDay = (day: string, n: number) => { const { from } = dayRange(day); from.setDate(from.getDate() + n); return keyOf(from); };
/** Monday of the week containing `d` */
export function weekStart(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
export const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—");
export const fmtDay = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => dayRange(key).from.toLocaleDateString("en-US", opts);
