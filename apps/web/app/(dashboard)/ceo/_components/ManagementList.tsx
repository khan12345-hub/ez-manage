"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, UserRoundX } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoManagement, type CeoMgmtPerson, type CeoPerson, type CeoSource } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

const ROLE: Record<string, string> = { OWNER: "Owner", ADMIN: "Admin", MEMBER: "Member", VIEWER: "Viewer", GUEST: "Guest", LIMITED_MEMBER: "Limited member" };
const errMsg = (e: any, fallback: string) => e?.response?.data?.message?.toString?.() ?? fallback;

function Chips({ s }: { s: { overdue: number; inProgress: number; doneWeek: number } }) {
  return (
    <span className="flex gap-1 font-mono text-[11.5px] font-semibold">
      <span title="Overdue" className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-destructive">{s.overdue}</span>
      <span title="Working on" className="rounded-md bg-[#b08d57]/15 px-1.5 py-0.5 text-[#8a6a35] dark:text-[#d9bd8c]">{s.inProgress}</span>
      <span title="Done in 7 days" className="rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{s.doneWeek}</span>
    </span>
  );
}
const Bar = ({ value }: { value: number }) => <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>;
const roleLine = (p: CeoMgmtPerson) => p.title ?? [...new Set(p.roles.map((r) => ROLE[r.role] ?? r.role))].join(" · ");

/**
 * Portfolio → Management & Teams: the managers (owners, admins, anyone people report to), each
 * opening to their team. People without a manager are grouped at the end; in Work companies
 * the CEO can set who they report to (through Work's own profile route).
 */
export function ManagementList({ source, company, meId, onMessage, onAssign }: { source: CeoSource; company: string | null; meId?: number; onMessage: (p: CeoPerson) => void; onAssign: (id: number) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ceo-tower", "management", source, company], queryFn: () => ceoApi.management(source, company), refetchInterval: 60_000 });
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [showOthers, setShowOthers] = useState(false);

  const setManager = useMutation({
    mutationFn: ({ uid, userId, managerId }: { uid: string; userId: number; managerId: number | null }) => api.patch(`/work/workspaces/${uid}/profiles/${userId}`, { managerId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ceo-tower", "management"] }); toast.success("Reporting line updated"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't change who they report to.")),
  });

  if (isLoading || !data) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>;

  /** Work companies this person is in where you can set their manager, with the candidates there */
  const reportsTo = (p: CeoMgmtPerson) => data.work.filter((w) => w.canSet && w.members.some((m) => m.userId === p.user.id)).map((w) => ({
    w, current: w.members.find((m) => m.userId === p.user.id)?.managerId ?? null,
    options: ([] as CeoMgmtPerson[]).concat(data.managers.filter((m) => m.user.id !== p.user.id && w.members.some((x) => x.userId === m.user.id)),
      // anyone in that company can become a manager
      data.unmanaged.filter((u) => u.user.id !== p.user.id && w.members.some((x) => x.userId === u.user.id))),
  }));

  const ReportsTo = ({ p }: { p: CeoMgmtPerson }) => {
    const rows = reportsTo(p);
    if (!rows.length) return null;
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {rows.map(({ w, current, options }) => (
          <label key={w.company.key} className="flex items-center gap-1">Reports to{rows.length > 1 ? ` (${w.company.name})` : ""}:
            <select aria-label={`${p.user.firstName} ${p.user.lastName} reports to`} value={current ?? ""} disabled={setManager.isPending}
              onChange={(e) => setManager.mutate({ uid: w.company.uid, userId: p.user.id, managerId: e.target.value ? Number(e.target.value) : null })}
              className="h-6 max-w-[150px] rounded border border-border bg-background px-1 text-[11.5px] text-foreground">
              <option value="">Nobody</option>
              {meId && w.members.some((x) => x.userId === meId) && <option value={meId}>You</option>}
              {options.map((o) => <option key={o.user.id} value={o.user.id}>{o.user.firstName} {o.user.lastName}</option>)}
            </select>
          </label>
        ))}
      </span>
    );
  };

  const Actions = ({ p }: { p: CeoMgmtPerson }) => p.user.id === meId ? null : (
    <span className="flex gap-1.5">
      <button type="button" onClick={() => onMessage(p.user)} aria-label={`Message ${p.user.firstName} ${p.user.lastName}`} className="rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:bg-accent">Message</button>
      <button type="button" onClick={() => onAssign(p.user.id)} aria-label={`Assign a task to ${p.user.firstName} ${p.user.lastName}`} className="rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:bg-accent">Assign task</button>
    </span>
  );

  return (
    <div className="space-y-2">
      <ul aria-label="Managers" className="space-y-2">
        {data.managers.map((m) => {
          const isOpen = !!open[m.user.id];
          return (
            <li key={m.user.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <Avatar user={m.user as any} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{m.user.firstName} {m.user.lastName}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{roleLine(m)} · {[...new Set(m.roles.map((r) => r.company.name))].join(", ")}</span>
                </span>
                <Chips s={m.stats} />
              </div>
              <span className="mt-2 flex items-center gap-2"><span className="flex-1"><Bar value={m.stats.progress} /></span><span className="font-mono text-[10.5px] text-muted-foreground">{m.stats.progress}%</span></span>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [m.user.id]: !isOpen }))} disabled={!m.reports.length}
                  className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold", m.reports.length ? "text-primary hover:bg-primary/5" : "text-muted-foreground")}>
                  {m.reports.length ? (isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
                  {m.reports.length ? `Team · ${m.reports.length} ${m.reports.length === 1 ? "person" : "people"}` : "No team yet"}
                  {m.reports.length > 0 && <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{m.team.open} open{m.team.overdue ? ` · ` : ""}{m.team.overdue ? <span className="text-destructive">{m.team.overdue} overdue</span> : null}</span>}
                </button>
                <span className="flex items-center gap-2"><span className="text-[11.5px] text-muted-foreground" title="Open tasks you gave this person">From you: <strong className="font-mono">{m.fromCeo}</strong></span><Actions p={m} /></span>
              </div>
              {isOpen && (
                <ul aria-label={`${m.user.firstName}'s team`} className="mt-2 space-y-1.5 border-l-2 border-primary/20 pl-3">
                  {m.reports.map((r) => (
                    <li key={`${r.company.key}-${r.user.id}`} className="rounded-lg bg-muted/30 px-2.5 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar user={r.user as any} size={26} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{r.user.firstName} {r.user.lastName}</span><span className="block truncate text-[11px] text-muted-foreground">{r.title ?? "Team member"} · {r.company.name} · {r.stats.open} open</span></span>
                        <Chips s={r.stats} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2"><ReportsTo p={r} /><Actions p={r} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {!data.managers.length && <li className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[12.5px] text-muted-foreground">No managers yet. Make someone an admin, or set who people report to.</li>}
      </ul>

      {data.unmanaged.length > 0 && (
        <section aria-label="Not under a manager" className="rounded-xl border border-dashed border-border p-2.5">
          <button type="button" aria-expanded={showOthers} onClick={() => setShowOthers((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
            {showOthers ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}<UserRoundX className="h-3.5 w-3.5" /> Not under a manager · {data.unmanaged.length}
          </button>
          {showOthers && (
            <ul className="mt-2 space-y-1.5">
              {data.unmanaged.map((p) => (
                <li key={p.user.id} className="rounded-lg bg-muted/30 px-2.5 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar user={p.user as any} size={26} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{p.user.firstName} {p.user.lastName}</span><span className="block truncate text-[11px] text-muted-foreground">{roleLine(p)} · {[...new Set(p.roles.map((r) => r.company.name))].join(", ")}</span></span>
                    <Chips s={p.stats} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2"><ReportsTo p={p} /><Actions p={p} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export type { CeoManagement };
