"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoOverview, type CeoSource, type CeoTaskState } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { AssignTaskDialog } from "./AssignTaskDialog";
import { SourceBadge, fmtDate } from "./bits";

const STATES: { id: CeoTaskState; label: string; tone?: "bad" | "good" | "warn" }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "Working on" },
  { id: "overdue", label: "Overdue", tone: "bad" },
  { id: "due_week", label: "Due this week" },
  { id: "done_week", label: "Done · 7 days", tone: "good" },
  { id: "unassigned", label: "Unassigned", tone: "warn" },
  { id: "all", label: "All" },
];
const PRIORITY: Record<string, string> = { URGENT: "#c0392b", HIGH: "#b08d57", NORMAL: "#3b6fd8", LOW: "#8a8f98" };

/** CEO Tower → Tasks: every task across your companies, filtered */
export function TasksView({ source, company, overview }: { source: CeoSource; company: string | null; overview: CeoOverview | undefined }) {
  const [state, setState] = useState<CeoTaskState>("open");
  const [person, setPerson] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [assigning, setAssigning] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ceo-tower", "tasks", source, company, person, state, q],
    queryFn: () => ceoApi.tasks({ source, company, person, state, q }),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });
  const people = overview?.people ?? [];
  const workCompanies = (overview?.companies ?? []).filter((c) => c.source === "work");

  return (
    <section aria-label="Tasks" className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[21px] leading-tight">Every task, every company</span>
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{data ? `${data.total} ${data.total === 1 ? "task" : "tasks"} in this view` : "Loading…"}</span>
        </span>
        <select aria-label="Person" value={person ?? ""} onChange={(e) => setPerson(Number(e.target.value) || null)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px]">
          <option value="">Everyone</option>
          {people.map((p) => <option key={p.user.id} value={p.user.id}>{p.user.firstName} {p.user.lastName}</option>)}
        </select>
        <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find a task, board or list" aria-label="Find a task" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <button type="button" onClick={() => setAssigning(true)} disabled={!workCompanies.length} title={workCompanies.length ? undefined : "Assigning works for Work companies"} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> Assign task</button>
      </header>
      <div role="tablist" aria-label="Task states" className="flex flex-wrap gap-1.5 border-b border-border px-5 py-2.5">
        {STATES.map((s) => {
          const n = data?.counts[s.id];
          return (
            <button key={s.id} type="button" role="tab" aria-selected={state === s.id} onClick={() => setState(s.id)}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium ring-1", state === s.id ? "bg-forest text-forest-foreground ring-forest dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground ring-border hover:text-foreground")}>
              {s.label}
              {n !== undefined && <span className={cn("font-mono text-[11px]", state !== s.id && s.tone === "bad" && n ? "text-destructive" : state !== s.id && s.tone === "warn" && n ? "text-[#8a6a35]" : "")}>{n}</span>}
            </button>
          );
        })}
        {isFetching && <span className="self-center text-[11px] text-muted-foreground">Refreshing…</span>}
      </div>

      {isLoading ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)}</div> : !data?.tasks.length ? (
        <p className="px-5 py-14 text-center text-[13px] text-muted-foreground">No tasks here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-2 font-normal">Task</th><th className="px-3 py-2 font-normal">Company</th><th className="px-3 py-2 font-normal">Status</th><th className="px-3 py-2 font-normal">People</th><th className="px-3 py-2 text-right font-normal">Due</th><th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody aria-label="Task rows">
              {data.tasks.map((t) => (
                <tr key={`${t.source}-${t.id}`} className={cn("border-b border-border/70 hover:bg-accent/30", t.overdue && "bg-destructive/[0.025]")}>
                  <td className="max-w-[420px] px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      {t.priority && t.priority !== "NONE" && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY[t.priority] ?? "#8a8f98" }} title={`${t.priority.toLowerCase()} priority`} />}
                      <span className={cn("truncate font-medium", t.done && "text-muted-foreground line-through")}>{t.name}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{t.where}</span>
                  </td>
                  <td className="px-3 py-2.5"><span className="flex items-center gap-1.5"><span className="max-w-[180px] truncate">{t.company.name}</span><SourceBadge source={t.source} /></span></td>
                  <td className="px-3 py-2.5">{t.status ? <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white" style={{ background: t.status.color }}>{t.status.label}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5">{t.assignees.length ? <span className="flex -space-x-1.5" title={t.assignees.map((a) => `${a.firstName} ${a.lastName}`).join(", ")}>{t.assignees.slice(0, 4).map((a) => <Avatar key={a.id} user={a as any} size={22} />)}</span> : <span className="text-[11.5px] font-medium text-[#8a6a35] dark:text-[#d9bd8c]">Unassigned</span>}</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono text-[12px]", t.overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>{t.due ? fmtDate(t.due) : "—"}</td>
                  <td className="px-3 py-2.5"><Link href={t.href} aria-label={`Open ${t.name} in ${t.source === "work" ? "Work" : "Boards"}`} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowUpRight className="h-4 w-4" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.truncated && <p className="px-5 py-3 text-[12px] text-muted-foreground">Showing the first {data.tasks.length} of {data.total}. Narrow it down with a company, person or search.</p>}
        </div>
      )}
      {assigning && <AssignTaskDialog companies={workCompanies} people={people} defaultCompany={company?.startsWith("work:") ? company : null} onClose={() => setAssigning(false)} />}
    </section>
  );
}
