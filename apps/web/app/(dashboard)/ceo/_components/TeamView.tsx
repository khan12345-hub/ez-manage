"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, MessageSquare, Plus, Search, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoCompany, type CeoPerson, type CeoSource, type CeoTask } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { AssignTaskDialog } from "./AssignTaskDialog";
import { MessageDialog } from "./MessageDialog";
import { SourceBadge, fmtDate } from "./bits";

type Sort = "attention" | "open" | "progress" | "name" | "active";
const ago = (iso: string | null) => { if (!iso) return "—"; const h = Math.round((Date.now() - +new Date(iso)) / 3_600_000); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };
const fullName = (p: CeoPerson) => `${p.firstName} ${p.lastName}`.trim();

/** CEO Tower → Team: everyone across your companies, their load and progress */
export function TeamView({ source, company, companies }: { source: CeoSource; company: string | null; companies: CeoCompany[] }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "team", source, company], queryFn: () => ceoApi.team(source, company), refetchInterval: 60_000 });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("attention");
  const [open, setOpen] = useState<CeoPerson | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = data.filter((r) => !t || `${fullName(r.user)} ${r.title ?? ""} ${r.memberships.map((m) => m.name).join(" ")}`.toLowerCase().includes(t));
    const by: Record<Sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      attention: (a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open,
      open: (a, b) => b.stats.open - a.stats.open,
      progress: (a, b) => b.stats.progress - a.stats.progress,
      name: (a, b) => fullName(a.user).localeCompare(fullName(b.user)),
      active: (a, b) => +new Date(b.lastActive ?? 0) - +new Date(a.lastActive ?? 0),
    };
    return [...list].sort(by[sort]);
  }, [data, q, sort]);
  const behind = data.filter((r) => r.stats.overdue > 0).length;

  return (
    <section aria-label="Team" className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft"><Users className="h-4.5 w-4.5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[21px] leading-tight">Team</span>
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{data.length} people · {behind} with overdue work</span>
        </span>
        <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-border bg-background px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person, title or company" aria-label="Find a person" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-[13px]">
          <option value="attention">Needs attention first</option><option value="open">Most open work</option><option value="progress">Best progress</option><option value="active">Recently active</option><option value="name">Name</option>
        </select>
      </header>
      {isLoading ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-2 font-normal">Person</th><th className="px-3 py-2 font-normal">Companies</th><th className="px-3 py-2 text-right font-normal">Open</th><th className="px-3 py-2 text-right font-normal">Working on</th><th className="px-3 py-2 text-right font-normal">Overdue</th><th className="px-3 py-2 text-right font-normal">Done 7d</th><th className="w-40 px-3 py-2 font-normal">Progress</th><th className="px-3 py-2 font-normal">Last active</th>
              </tr>
            </thead>
            <tbody aria-label="People">
              {rows.map((r) => (
                <tr key={r.user.id} onClick={() => setOpen(r.user)} className={cn("cursor-pointer border-b border-border/70 hover:bg-accent/30", r.stats.overdue > 0 && "bg-destructive/[0.025]")}>
                  <td className="px-5 py-2.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(r.user); }} className="flex items-center gap-2.5 text-left">
                      <Avatar user={r.user as any} size={30} />
                      <span><span className="block font-semibold">{fullName(r.user)}</span><span className="block text-[11.5px] text-muted-foreground">{r.title ?? (r.memberships[0]?.role.toLowerCase() ?? "")}{r.manager?.name ? ` · reports to ${r.manager.name}` : ""}{r.reports ? ` · ${r.reports} reports` : ""}</span></span>
                    </button>
                  </td>
                  <td className="max-w-[240px] px-3 py-2.5"><span className="flex flex-wrap gap-1">{r.memberships.slice(0, 3).map((m) => <span key={m.key} className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"><span className="max-w-[120px] truncate">{m.name}</span><SourceBadge source={m.source} /></span>)}{r.memberships.length > 3 && <span className="text-[11px] text-muted-foreground">+{r.memberships.length - 3}</span>}</span></td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.stats.open}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{r.stats.inProgress}</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono", r.stats.overdue && "font-semibold text-destructive")}>{r.stats.overdue}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-primary">{r.stats.doneWeek}</td>
                  <td className="px-3 py-2.5"><span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${r.stats.progress}%` }} /></span><span className="w-9 text-right font-mono text-[11px] text-muted-foreground">{r.stats.progress}%</span></span></td>
                  <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">{ago(r.lastActive)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8} className="py-12 text-center text-[13px] text-muted-foreground">No one matches.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && <PersonPanel person={open} companies={companies} onClose={() => setOpen(null)} />}
    </section>
  );
}

/** one person in depth, with Message / Assign */
export function PersonPanel({ person, companies, onClose }: { person: CeoPerson; companies: CeoCompany[]; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const { data: r, isLoading } = useQuery({ queryKey: ["ceo-tower", "person-report", person.id, days], queryFn: () => ceoApi.personReport(person.id, days) });
  const [message, setMessage] = useState(false);
  const [assign, setAssign] = useState(false);
  const section = (title: string, list: CeoTask[] | undefined, tone?: "bad" | "good") => (
    <section aria-label={title} className="mt-4">
      <h3 className={cn("mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide", tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : "text-muted-foreground")}>{title} <span className="font-mono font-normal">{list?.length ?? 0}</span></h3>
      {!list?.length ? <p className="text-[12.5px] text-muted-foreground">Nothing here.</p> : (
        <ul className="space-y-1">
          {list.map((t) => (
            <li key={`${t.source}-${t.id}`}><Link href={t.href} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-accent/40">
              <span className="min-w-0 flex-1"><span className={cn("block truncate font-medium", t.done && "text-muted-foreground line-through")}>{t.name}</span><span className="block truncate text-[11px] text-muted-foreground">{t.company.name} / {t.where}</span></span>
              {t.status && <span className="rounded-full px-1.5 text-[10.5px] font-semibold text-white" style={{ background: t.status.color }}>{t.status.label}</span>}
              <span className={cn("w-14 text-right font-mono text-[11px]", t.overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>{t.due ? fmtDate(t.due) : "—"}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link></li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
        <div className="border-b border-border px-6 pb-4 pt-5">
          <SheetTitle className="flex items-center gap-3 font-serif text-[24px] font-normal"><Avatar user={person as any} size={40} /> {fullName(person)}</SheetTitle>
          <SheetDescription className="mt-1 text-[12.5px]">{r ? [r.title, ...r.memberships.map((m) => `${m.name} (${m.source})`)].filter(Boolean).join(" · ") : "Loading…"}</SheetDescription>
          {r && !r.isMe && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setMessage(true)} className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><MessageSquare className="h-3.5 w-3.5" /> Message</button>
              <button type="button" disabled={!companies.length} onClick={() => setAssign(true)} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-medium hover:bg-accent disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Assign task</button>
            </div>
          )}
        </div>
        <div className="px-6 py-4">
          {isLoading || !r ? <div className="h-40 animate-pulse rounded-lg bg-muted" /> : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {([["Open", r.counts.open, ""], ["Working on", r.counts.inProgress, ""], ["Overdue", r.counts.overdue, r.counts.overdue ? "text-destructive" : ""], [`Done · ${days}d`, r.counts.doneInWindow, "text-primary"]] as const).map(([l, v, c]) => (
                  <div key={l} className="rounded-xl border border-border px-3 py-2"><p className="font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">{l}</p><p className={cn("font-serif text-[24px] leading-tight", c)}>{v}</p></div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">Window:
                {[7, 14, 30].map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={cn("rounded-md px-2 py-0.5", days === d ? "bg-accent font-semibold text-foreground" : "hover:text-foreground")}>{d} days</button>)}
                {r.teams.length > 0 && <span className="ml-auto">Teams: {r.teams.join(", ")}</span>}
              </div>
              {section("Overdue", r.overdue, "bad")}
              {section("Working on", r.inProgress)}
              {section("Due in the next 7 days", r.dueSoon)}
              {section(`Finished in the last ${days} days`, r.finished, "good")}
              <section aria-label="Talking with" className="mt-4">
                <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Talking with · last {days} days</h3>
                <p className="mb-1.5 text-[11px] text-muted-foreground">Message counts only — what was written stays private.</p>
                {!r.talkingWith.length ? <p className="text-[12.5px] text-muted-foreground">No chat activity in Work.</p> : (
                  <ul className="space-y-1">
                    {r.talkingWith.map((c, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[12.5px]"><span className="min-w-0 flex-1 truncate">{c.conversation}</span><span className="font-mono text-[11px] text-muted-foreground">{c.sent_by_person ?? 0} sent · {c.messages} total</span></li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
        {message && <MessageDialog person={person} onClose={() => setMessage(false)} />}
        {assign && <AssignTaskDialog companies={r ? companies.filter((c) => r.memberships.some((m) => m.key === c.key)) : companies} people={[]} defaultCompany={r?.memberships[0]?.key ?? null} defaultAssignee={person.id} onClose={() => setAssign(false)} />}
      </SheetContent>
    </Sheet>
  );
}
