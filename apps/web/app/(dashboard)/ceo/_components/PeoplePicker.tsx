"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

/**
 * Pick people from the CEO's companies. The common case — search and add a couple of people — stays
 * front and centre; bulk group adds (Management, a Work team, a whole company) are tucked behind an
 * "Add a group" toggle and split by product so Boards and Work groups aren't mixed and confusing.
 */
export function PeoplePicker({ value, onChange, label = "People" }: { value: number[]; onChange: (ids: number[]) => void; label?: string }) {
  const { user } = useAuth();
  const { data: team = [] } = useQuery({ queryKey: ["ceo-tower", "team", "all", null], queryFn: () => ceoApi.team("all") });
  const { data: aud } = useQuery({ queryKey: ["ceo-tower", "audiences"], queryFn: ceoApi.audiences });
  const [q, setQ] = useState("");
  const [showGroups, setShowGroups] = useState(false);

  const people = useMemo(() => team.map((t) => t.user).filter((u) => u.id !== user?.id), [team, user?.id]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const qq = q.trim().toLowerCase();
  const shown = people.filter((p) => !qq || `${p.firstName} ${p.lastName}`.toLowerCase().includes(qq));
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const addAll = (ids: number[]) => onChange([...new Set([...value, ...ids])]);

  const boardsCos = (aud?.companies ?? []).filter((c) => c.source === "boards");
  const workCos = (aud?.companies ?? []).filter((c) => c.source === "work");
  const hasGroups = !!aud && (aud.management.length > 0 || (aud.teams?.length ?? 0) > 0 || (aud.companies?.length ?? 0) > 0);
  const grp = "rounded-full border border-border px-2.5 py-0.5 text-[12px] hover:bg-accent";
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div><p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="flex flex-wrap gap-1.5">{children}</div></div>
  );

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">{label}{value.length > 0 && <span className="text-foreground"> · {value.length}</span>}</span>
        {hasGroups && <button type="button" onClick={() => setShowGroups((s) => !s)} className="flex items-center gap-1 text-[11.5px] font-medium text-primary hover:underline"><Users className="h-3 w-3" /> {showGroups ? "Hide groups" : "Add a group"}</button>}
      </div>

      {value.length > 0 && (
        <ul aria-label="Chosen" className="mb-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {value.map((id) => { const p = byId.get(id); return p ? (
            <li key={id}><span className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-1.5 text-[12px] font-medium"><Avatar user={p as any} size={18} />{p.firstName} {p.lastName}<button type="button" aria-label={`Remove ${p.firstName}`} onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button></span></li>
          ) : null; })}
        </ul>
      )}

      <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2.5"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="w-full bg-transparent text-[13px] outline-none" /></label>
      <ul aria-label={label} className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-border p-1">
        {shown.map((p) => {
          const on = value.includes(p.id);
          return (
            <li key={p.id}><button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[13px] hover:bg-accent", on && "font-semibold")}>
              <Avatar user={p as any} size={20} /><span className="flex-1 truncate">{p.firstName} {p.lastName}</span>{on && <Check className="h-3.5 w-3.5 text-primary" />}
            </button></li>
          );
        })}
        {!shown.length && <li className="px-2 py-2 text-[12px] text-muted-foreground">No one matches.</li>}
      </ul>

      {showGroups && aud && (
        <div className="mt-2 space-y-2.5">
          {aud.management.length > 0 && <button type="button" onClick={() => addAll(aud.management)} className={cn(grp, "flex items-center gap-1")}><Crown className="h-3 w-3 text-[#b08d57]" /> Owners & admins ({aud.management.length})</button>}
          {boardsCos.length > 0 && <Section title="Accounts & Invoices">{boardsCos.map((c) => <button key={c.key} type="button" onClick={() => addAll(c.people)} className={grp}>Everyone · {c.name}</button>)}</Section>}
          {(workCos.length > 0 || (aud.teams?.length ?? 0) > 0) && (
            <Section title="Company Work">
              {aud.teams?.map((t) => <button key={t.id} type="button" onClick={() => addAll(t.people)} className={cn(grp, "flex items-center gap-1")}><Users className="h-3 w-3" /> {t.name} ({t.people.length})</button>)}
              {workCos.map((c) => <button key={c.key} type="button" onClick={() => addAll(c.people)} className={grp}>Everyone · {c.name}</button>)}
            </Section>
          )}
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="text-[12px] font-medium text-primary hover:underline">Clear all</button>}
        </div>
      )}
    </div>
  );
}
