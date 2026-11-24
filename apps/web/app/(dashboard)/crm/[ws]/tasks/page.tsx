"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ListTodo, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { contactName, crmApi, crmKeys, userName, type CrmActivity } from "@/services/crm.api";
import { fmtDate, glass, isPast, onErr, useCrmWs } from "../../_lib/crm";
import { Avatar, Empty, Skeleton } from "../../_components/bits";
import { CreateRecord } from "../../_components/CreateRecord";

const STATES = [["overdue", "Overdue"], ["today", "Today"], ["upcoming", "Upcoming"], ["open", "All open"], ["done", "Done"]] as const;
type St = (typeof STATES)[number][0];

function Tasks() {
  const { uid, ws } = useCrmWs();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [state, setState] = useState<St>(((sp?.get("state") as St) || "open"));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [create, setCreate] = useState(false);
  const query = { state, scope };
  const { data, isLoading } = useQuery({ queryKey: crmKeys.tasks(uid, query), queryFn: () => crmApi.tasks(uid, query), enabled: !!uid });
  const toggle = useMutation({
    mutationFn: (a: CrmActivity) => crmApi.updateActivity(uid, a.id, { done: !a.doneAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", uid] }),
    onError: onErr(),
  });
  const counts = data?.counts;
  const link = (a: CrmActivity) => a.deal ? { href: `/crm/${uid}/deals/${a.deal.id}`, label: a.deal.name } : a.contact ? { href: `/crm/${uid}/contacts/${a.contact.id}`, label: contactName(a.contact) } : a.company ? { href: `/crm/${uid}/companies/${a.company.id}`, label: a.company.name } : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Which tasks" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-0.5">
          {STATES.map(([k, l]) => {
            const n = k === "overdue" ? counts?.overdue : k === "today" ? counts?.today : k === "open" ? counts?.open : undefined;
            return <button key={k} type="button" role="tab" aria-selected={state === k} onClick={() => setState(k)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium", state === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}{n ? <span className={cn("rounded-full px-1.5 text-[10.5px] font-bold", k === "overdue" ? "bg-[#dc2626]/10 text-[#dc2626] dark:text-[#f87171]" : "bg-black/[0.05] dark:bg-white/[0.08]")}>{n}</span> : null}</button>;
          })}
        </div>
        <select aria-label="Whose tasks" value={scope} onChange={(e) => setScope(e.target.value as "mine" | "all")} className="h-9 rounded-xl border border-border bg-background px-2.5 text-[13px]"><option value="mine">My tasks</option><option value="all">Everyone&apos;s tasks</option></select>
        <span className="flex-1" />
        {ws?.canEdit && <button type="button" onClick={() => setCreate(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New task</button>}
      </div>
      {isLoading ? <Skeleton className="h-80" /> : !data?.rows.length ? (
        <div className={glass}><Empty icon={ListTodo} title={state === "overdue" ? "Nothing overdue 👏" : state === "done" ? "Nothing done yet" : "No tasks here"} body="Add tasks from a contact, company or deal timeline, or with New task." /></div>
      ) : (
        <ul className={cn(glass, "divide-y divide-border/60 overflow-hidden")}>
          {data.rows.map((a) => { const l = link(a); const late = !a.doneAt && isPast(a.dueAt); return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              <button type="button" aria-label={a.doneAt ? `Mark “${a.subject}” not done` : `Mark “${a.subject}” done`} onClick={() => toggle.mutate(a)} disabled={!ws?.canEdit} className="text-muted-foreground transition hover:text-primary">{a.doneAt ? <CheckCircle2 className="h-5 w-5 text-[#047857]" /> : <Circle className="h-5 w-5" />}</button>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[14px] font-medium", a.doneAt && "text-muted-foreground line-through")}>{a.subject}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{l ? <Link href={l.href} className="hover:underline">{l.label}</Link> : "No record"}{a.body && <> · {a.body}</>}</span>
              </span>
              {scope === "all" && a.assignee && <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex"><Avatar user={a.assignee} size={20} />{userName(a.assignee)}</span>}
              <span className={cn("w-20 shrink-0 text-right text-[12.5px]", late ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{a.dueAt ? fmtDate(a.dueAt) : "No date"}</span>
            </li>
          ); })}
        </ul>
      )}
      {create && <CreateRecord kind="task" onClose={() => setCreate(false)} />}
    </div>
  );
}

export default function CrmTasksPage() {
  return <Suspense><Tasks /></Suspense>;
}
