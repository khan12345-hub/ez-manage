"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ListChecks, MessageSquare, Plus, Share2, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoCompany, type CeoPerson, type CeoTask, type CeoTaskState } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { AssignTaskDialog } from "./AssignTaskDialog";
import { MessageDialog } from "./MessageDialog";
import { SourceBadge, fmtDate } from "./bits";

export type PanelTab = { tab: "tasks"; state: CeoTaskState } | { tab: "people" };
const STATES: { id: CeoTaskState; label: string }[] = [{ id: "open", label: "Open" }, { id: "overdue", label: "Overdue" }, { id: "in_progress", label: "Working on" }, { id: "unassigned", label: "Unassigned" }, { id: "done_week", label: "Done · 7d" }, { id: "all", label: "All" }];
const fullName = (p: CeoPerson) => `${p.firstName} ${p.lastName}`.trim();

/**
 * A company's tasks and people right inside CEO Tower, with actions: message a person,
 * assign them a task, share a task with someone, or open it in its product.
 */
export function CompanyPanel({ company, start, workCompanies, onClose }: { company: CeoCompany; start: PanelTab; workCompanies: CeoCompany[]; onClose: () => void }) {
  const [tab, setTab] = useState<"tasks" | "people">(start.tab);
  const [state, setState] = useState<CeoTaskState>(start.tab === "tasks" ? start.state : "open");
  const [person, setPerson] = useState<CeoPerson | null>(null);
  const [message, setMessage] = useState<{ to: CeoPerson; text?: string; heading?: string } | null>(null);
  const [assignTo, setAssignTo] = useState<CeoPerson | null>(null);
  const [sharing, setSharing] = useState<CeoTask | null>(null);
  const tasks = useQuery({ queryKey: ["ceo-tower", "tasks", "all", company.key, person?.id ?? null, state, ""], queryFn: () => ceoApi.tasks({ source: "all", company: company.key, person: person?.id ?? null, state }), enabled: tab === "tasks" });
  const people = useQuery({ queryKey: ["ceo-tower", "overview", "all", company.key], queryFn: () => ceoApi.overview("all", company.key), enabled: tab === "people" || !!sharing });
  const team = people.data?.people ?? [];
  const assignable = company.source === "work" ? [company] : workCompanies;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[720px]">
        <div className="border-b border-border px-6 pb-3 pt-5">
          <SheetTitle className="flex items-center gap-2 font-serif text-[24px] font-normal">{company.name} <SourceBadge source={company.source} /></SheetTitle>
          <SheetDescription className="mt-0.5 text-[12.5px]">{company.stats.open} open · {company.stats.overdue} overdue · {company.stats.inProgress} working on · {company.people} people · {company.stats.progress}% done</SheetDescription>
          <div role="tablist" aria-label="Company panel" className="mt-3 flex gap-1">
            {([["tasks", "Tasks", ListChecks], ["people", "People", Users]] as const).map(([id, l, I]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold", tab === id ? "bg-forest text-forest-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:bg-accent")}><I className="h-3.5 w-3.5" /> {l}</button>
            ))}
            <span className="flex-1" />
            <Link href={company.source === "work" ? `/work/${company.uid}` : `/workspace/${company.uid}`} className="flex items-center gap-1 self-center text-[12.5px] font-semibold text-primary hover:underline">Open in {company.source === "work" ? "Work" : "Boards"} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {tab === "tasks" ? (
            <>
              <div role="tablist" aria-label="Task states" className="mb-3 flex flex-wrap items-center gap-1.5">
                {STATES.map((s) => (
                  <button key={s.id} type="button" role="tab" aria-selected={state === s.id} onClick={() => setState(s.id)} className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1", state === s.id ? "bg-primary/10 text-primary ring-primary/40" : "text-muted-foreground ring-border hover:text-foreground")}>
                    {s.label}{tasks.data && <span className="ml-1 font-mono">{tasks.data.counts[s.id]}</span>}
                  </button>
                ))}
                {person && <button type="button" onClick={() => setPerson(null)} className="ml-1 rounded-full bg-[#b08d57]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#8a6a35] dark:text-[#d9bd8c]">{fullName(person)} ✕</button>}
              </div>
              {tasks.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div> : !tasks.data?.tasks.length ? (
                <p className="py-10 text-center text-[13px] text-muted-foreground">No tasks here.</p>
              ) : (
                <ul aria-label="Company tasks" className="space-y-1.5">
                  {tasks.data.tasks.map((t) => (
                    <li key={`${t.source}-${t.id}`} className={cn("flex items-center gap-3 rounded-lg border border-border px-3 py-2", t.overdue && "border-destructive/30 bg-destructive/[0.03]")}>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[13.5px] font-medium", t.done && "text-muted-foreground line-through")}>{t.name}</span>
                        <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                          <span className="truncate">{t.where}</span>
                          {t.status && <span className="rounded-full px-1.5 text-[10.5px] font-semibold text-white" style={{ background: t.status.color }}>{t.status.label}</span>}
                          <span className={cn("font-mono", t.overdue && "font-semibold text-destructive")}>{t.due ? fmtDate(t.due) : "no date"}</span>
                        </span>
                      </span>
                      {t.assignees.length ? <span className="flex -space-x-1.5">{t.assignees.slice(0, 3).map((a) => <Avatar key={a.id} user={a as any} size={22} />)}</span> : <span className="text-[11px] font-medium text-[#8a6a35] dark:text-[#d9bd8c]">Unassigned</span>}
                      <button type="button" aria-label={`Share ${t.name}`} title="Share with someone" onClick={() => setSharing(t)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Share2 className="h-4 w-4" /></button>
                      <Link href={t.href} aria-label={`Open ${t.name}`} title="Open" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowUpRight className="h-4 w-4" /></Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : people.isLoading ? <div className="h-40 animate-pulse rounded-lg bg-muted" /> : (
            <ul aria-label="Company people" className="space-y-2">
              {team.map((p) => (
                <li key={p.user.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={p.user as any} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{fullName(p.user)}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{p.stats.open} open · <span className={p.stats.overdue ? "font-semibold text-destructive" : ""}>{p.stats.overdue} overdue</span> · {p.stats.inProgress} working on · {p.stats.doneWeek} done this week</span>
                    </span>
                    <span className="font-serif text-[20px]">{p.stats.progress}%</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setMessage({ to: p.user })} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><MessageSquare className="h-3.5 w-3.5" /> Message</button>
                    <button type="button" disabled={!assignable.length} onClick={() => setAssignTo(p.user)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Assign task</button>
                    <button type="button" onClick={() => { setPerson(p.user); setState("open"); setTab("tasks"); }} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12.5px] font-medium hover:bg-accent"><ListChecks className="h-3.5 w-3.5" /> Their tasks</button>
                  </div>
                </li>
              ))}
              {!team.length && <li className="py-10 text-center text-[13px] text-muted-foreground">No people here yet.</li>}
            </ul>
          )}
        </div>
        {/* rendered inside the panel so clicks in them don't count as "outside" and close it */}
      {sharing && <SharePicker task={sharing} people={team.map((p) => p.user)} loading={people.isLoading} onPick={(to) => { setMessage({ to, heading: `Share with ${to.firstName}`, text: `Please take a look at this task: [${sharing.name}](${typeof window !== "undefined" ? window.location.origin : ""}${sharing.href})` }); setSharing(null); }} onClose={() => setSharing(null)} />}
      {message && <MessageDialog person={message.to} defaultText={message.text} heading={message.heading} onClose={() => setMessage(null)} />}
      {assignTo && <AssignTaskDialog companies={assignable} people={[]} defaultCompany={assignable[0]?.key ?? null} defaultAssignee={assignTo.id} onClose={() => setAssignTo(null)} />}
      </SheetContent>
    </Sheet>
  );
}

/** choose who to share a task with */
function SharePicker({ task, people, loading, onPick, onClose }: { task: CeoTask; people: CeoPerson[]; loading: boolean; onPick: (p: CeoPerson) => void; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[380px]">
        <SheetTitle className="font-serif text-[20px] font-normal">Share a task</SheetTitle>
        <SheetDescription className="line-clamp-2">“{task.name}” — pick who should see it. They get it as a message from you.</SheetDescription>
        <ul aria-label="Share with" className="mt-3 space-y-1 overflow-y-auto">
          {loading ? <li className="h-20 animate-pulse rounded-lg bg-muted" /> : people.map((p) => (
            <li key={p.id}><button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13.5px] hover:bg-accent"><Avatar user={p as any} size={26} /> {fullName(p)}</button></li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
