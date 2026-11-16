"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi, useCeoAccess } from "@/services/ceo-tower.api";

const fmt = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—");
const HEALTH: Record<string, string> = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };

/**
 * CEO Tower → Report: one printable page (Download PDF = the browser's "Save as PDF") with the
 * brief, the numbers, every company, managers and their teams, the weekly trend, what is most
 * overdue and the CEO's own tasks.
 */
export default function CeoReportPage() {
  const { user } = useAuth();
  const access = useCeoAccess();
  const on = access.allowed;
  const { data: o } = useQuery({ queryKey: ["ceo-tower", "overview", "all", null], queryFn: () => ceoApi.overview("all"), enabled: on });
  const { data: m } = useQuery({ queryKey: ["ceo-tower", "management", "all", null], queryFn: () => ceoApi.management("all"), enabled: on });
  const { data: brief } = useQuery({ queryKey: ["ceo-tower", "brief"], queryFn: () => ceoApi.brief(), enabled: on, staleTime: 10 * 60_000 });
  const { data: tr } = useQuery({ queryKey: ["ceo-tower", "trends", "all", null], queryFn: () => ceoApi.trends("all"), enabled: on });
  const { data: mine } = useQuery({ queryKey: ["ceo-tower", "tasks", "report-mine"], queryFn: () => ceoApi.tasks({ source: "all", state: "open", mine: true }), enabled: on });
  const ready = o && m && tr && mine;

  if (!access.loading && !on) return <p className="p-10 text-center text-[13px] text-muted-foreground">CEO Tower is only for Administrators.</p>;
  return (
    <div className="min-h-full bg-[#f6f8f6] py-6 print:bg-white print:py-0 dark:bg-background">
      <div className="mx-auto max-w-[900px] px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href="/ceo" className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to CEO Tower</Link>
          <button type="button" onClick={() => window.print()} disabled={!ready} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><Download className="h-4 w-4" /> Download PDF</button>
        </div>
        <article className="rounded-2xl border border-border bg-card p-8 text-[13px] text-foreground print:rounded-none print:border-0 print:p-0 print:text-black">
          <header className="flex items-end justify-between border-b-2 border-[#b08d57] pb-3">
            <div><p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">EZ Manage · CEO Tower</p><h1 className="font-serif text-[28px] leading-tight">Executive report</h1></div>
            <p className="text-right text-[12px] text-muted-foreground">{new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}<br />Prepared for {user?.firstName} {user?.lastName}</p>
          </header>
          {!ready ? <p className="py-16 text-center text-muted-foreground">Preparing the report…</p> : (
            <>
              <Section title="Summary · last 24 hours">
                <ul className="list-disc space-y-1 pl-5">{(brief?.bullets ?? []).map((b, i) => <li key={i}>{b}</li>)}</ul>
              </Section>

              <Section title="At a glance">
                <div className="grid grid-cols-4 gap-2">
                  {([["Companies", o.kpis.companies], ["People", o.kpis.people], ["Open tasks", o.kpis.open], ["In progress", o.kpis.inProgress], ["Overdue", o.kpis.overdue], ["Done · 7 days", o.kpis.doneWeek], ["Progress", `${o.kpis.progress}%`], ["Unassigned", o.kpis.unassigned]] as const).map(([l, v]) => (
                    <div key={l} className="rounded-lg border border-border px-3 py-2 print:break-inside-avoid"><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">{l}</p><p className="font-serif text-[20px]">{v}</p></div>
                  ))}
                </div>
              </Section>

              <Section title="Companies">
                <Table head={["Company", "Product", "Health", "Open", "Overdue", "In progress", "People", "Progress"]}
                  rows={o.companies.map((c) => [c.name, c.source === "work" ? "Work" : "Boards", HEALTH[c.health] ?? c.health, c.stats.open, c.stats.overdue, c.stats.inProgress, c.people, `${c.stats.progress}%`])} />
              </Section>

              <Section title="Management and teams">
                {!m.managers.length ? <p className="text-muted-foreground">No managers set yet.</p> : m.managers.map((g) => (
                  <div key={g.user.id} className="mb-3 print:break-inside-avoid">
                    <p className="font-semibold">{g.user.firstName} {g.user.lastName} <span className="font-normal text-muted-foreground">· {g.title ?? [...new Set(g.roles.map((r) => r.role.toLowerCase()))].join(", ")} · {g.stats.open} open, {g.stats.overdue} overdue · team {g.reports.length}</span></p>
                    {g.reports.length > 0 && <Table head={["Team member", "Company", "Open", "Overdue", "In progress", "Done 7d"]} rows={g.reports.map((r) => [`${r.user.firstName} ${r.user.lastName}`, r.company.name, r.stats.open, r.stats.overdue, r.stats.inProgress, r.stats.doneWeek])} />}
                  </div>
                ))}
                {m.unmanaged.length > 0 && <p className="mt-1 text-[12px] text-muted-foreground">Not under a manager: {m.unmanaged.map((u) => `${u.user.firstName} ${u.user.lastName}`).join(", ")}</p>}
              </Section>

              <Section title="Trend · tasks per week">
                <Table head={["Week of", "Created", "Completed"]} rows={tr.weeks.map((w) => [fmt(w.start), w.created, w.completed])} />
              </Section>

              <Section title="Most overdue">
                <Table head={["Task", "Company", "People", "Due"]} rows={o.attention.overdue.slice(0, 15).map((t) => [t.task.name, t.company ?? "", t.people.join(", ") || "unassigned", fmt(t.due)])} />
              </Section>

              <Section title={`Your open tasks (${mine.total})`}>
                {!mine.tasks.length ? <p className="text-muted-foreground">Nothing open that you gave out.</p> : (
                  <Table head={["Task", "Company", "People", "Status", "Due"]} rows={mine.tasks.slice(0, 25).map((t) => [t.name, t.company.name, t.assignees.map((a) => `${a.firstName} ${a.lastName}`).join(", ") || "unassigned", t.status?.label ?? "—", `${fmt(t.due)}${t.overdue ? " (late)" : ""}`])} />
                )}
              </Section>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6 print:break-inside-avoid-page"><h2 className="mb-2 font-serif text-[18px]">{title}</h2>{children}</section>;
}
function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead><tr>{head.map((h) => <th key={h} className="border-b border-border py-1 pr-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="print:break-inside-avoid">{r.map((c, j) => <td key={j} className="border-b border-border/60 py-1 pr-2">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}
