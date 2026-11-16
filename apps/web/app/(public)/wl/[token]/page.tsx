"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Data = { list: string; space: string; company: string; tasks: { name: string; status: { name: string; color: string } | null; due: string | null; priority: string | null; done: boolean; people: string[] }[] };

/** Public, read-only copy of a Work list ("Share this list"). */
export default function PublicListPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ["wl", token], queryFn: async () => (await api.get<Data>(`/work/public/lists/${token}`)).data, retry: false });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="min-h-screen bg-[#f6f8f6] px-4 py-8 dark:bg-background">
      <div className="mx-auto max-w-[900px]">
        {isLoading ? <div className="h-80 animate-pulse rounded-2xl bg-muted" /> : isError || !data ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center"><p className="text-[18px] font-semibold">This link is not active</p><p className="mt-1 text-[13.5px] text-muted-foreground">It may have been turned off.</p></div>
        ) : (
          <div className="rounded-2xl border border-border bg-card">
            <header className="border-b border-border px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{data.company} · {data.space}</p>
              <h1 className="mt-1 text-[24px] font-semibold">{data.list}</h1>
              <p className="text-[12.5px] text-muted-foreground">{data.tasks.filter((t) => !t.done).length} open · {data.tasks.filter((t) => t.done).length} done · read-only</p>
            </header>
            <ul aria-label="Tasks" className="divide-y divide-border">
              {data.tasks.map((t, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-6 py-2.5 text-[13.5px]">
                  <span className={cn("min-w-0 flex-1 truncate font-medium", t.done && "text-muted-foreground line-through")}>{t.name}</span>
                  {t.status && <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: t.status.color }}>{t.status.name}</span>}
                  {t.people.length > 0 && <span className="text-[12px] text-muted-foreground">{t.people.join(", ")}</span>}
                  <span className={cn("w-20 text-right font-mono text-[12px]", !t.done && t.due && t.due < today ? "font-semibold text-destructive" : "text-muted-foreground")}>{t.due ? new Date(`${t.due}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}</span>
                </li>
              ))}
              {!data.tasks.length && <li className="px-6 py-10 text-center text-muted-foreground">No tasks yet.</li>}
            </ul>
            <p className="border-t border-border px-6 py-3 text-center text-[11px] text-muted-foreground">Shared from EZ Manage</p>
          </div>
        )}
      </div>
    </div>
  );
}
