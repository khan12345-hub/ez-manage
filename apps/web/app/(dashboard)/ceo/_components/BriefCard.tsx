"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi } from "@/services/ceo-tower.api";

/** Master Updates → the last 24 hours across all companies, written by the Executive AI from live data */
export function BriefCard() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, isError } = useQuery({ queryKey: ["ceo-tower", "brief"], queryFn: () => ceoApi.brief(), staleTime: 10 * 60_000, retry: false });
  const refresh = async () => { qc.setQueryData(["ceo-tower", "brief"], await ceoApi.brief(true)); };
  return (
    <section aria-label="Last 24 hours" className="rounded-xl border border-[#b08d57]/35 bg-[#b08d57]/[0.06] p-3">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8a6a35] dark:text-[#d9bd8c]">
        <Sparkles className="h-3.5 w-3.5" /> {data?.by === "summary" ? "Summary" : "AI synthesis"} · last 24 hours
        <span className="flex-1" />
        {data && <span className="font-mono text-[10px] font-normal text-muted-foreground">{new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
        <button type="button" onClick={refresh} disabled={isFetching} aria-label="Refresh summary" className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} /></button>
      </h3>
      {isLoading ? (
        <div className="mt-2 space-y-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 15}%` }} />)}</div>
      ) : isError || !data ? (
        <p className="mt-1.5 text-[12px] text-muted-foreground">The summary isn&apos;t available right now.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {data.bullets.map((b, i) => <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#b08d57]" />{b}</li>)}
        </ul>
      )}
    </section>
  );
}
