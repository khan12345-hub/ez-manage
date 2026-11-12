"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ceoApi } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";

/**
 * Choose people from the CEO's companies, one by one or by group:
 * Management (owners, admins, managers), a Work team, or a whole company.
 */
export function PeoplePicker({ value, onChange, label = "People" }: { value: number[]; onChange: (ids: number[]) => void; label?: string }) {
  const { user } = useAuth();
  const { data: team = [] } = useQuery({ queryKey: ["ceo-tower", "team", "all", null], queryFn: () => ceoApi.team("all") });
  const { data: aud } = useQuery({ queryKey: ["ceo-tower", "audiences"], queryFn: ceoApi.audiences });
  const [q, setQ] = useState("");
  const people = useMemo(() => team.map((t) => t.user).filter((u) => u.id !== user?.id), [team, user?.id]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const shown = people.filter((p) => !q.trim() || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q.trim().toLowerCase()));
  const add = (ids: number[]) => onChange([...new Set([...value, ...ids.filter((i) => byId.has(i))])]);
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const chip = "flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[12px] hover:bg-accent";

  return (
    <div>
      <p className="mb-1 text-[12px] font-medium text-muted-foreground">{label} <span className="font-mono">{value.length ? `· ${value.length} chosen` : ""}</span></p>
      <div role="group" aria-label="Quick add" className="mb-2 flex flex-wrap gap-1.5">
        {aud && aud.management.length > 0 && <button type="button" onClick={() => add(aud.management)} className={chip}><Crown className="h-3 w-3 text-[#b08d57]" /> Management ({aud.management.length})</button>}
        {aud?.teams.map((t) => <button key={`t${t.id}`} type="button" onClick={() => add(t.people)} className={chip}><Users className="h-3 w-3" /> {t.name} ({t.people.length})</button>)}
        {aud?.companies.map((c) => <button key={c.key} type="button" onClick={() => add(c.people)} className={chip}>Everyone · {c.name} <span className="font-mono text-[10px] uppercase text-muted-foreground">{c.source}</span></button>)}
        {value.length > 0 && <button type="button" onClick={() => onChange([])} className="px-1 text-[12px] font-medium text-primary hover:underline">Clear</button>}
      </div>
      {value.length > 0 && (
        <ul aria-label="Chosen" className="mb-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {value.map((id) => { const p = byId.get(id); return p ? (
            <li key={id}><span className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-0.5 pr-1.5 text-[12px] font-medium"><Avatar user={p as any} size={18} />{p.firstName} {p.lastName}<button type="button" aria-label={`Remove ${p.firstName}`} onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-primary/20"><X className="h-3 w-3" /></button></span></li>
          ) : null; })}
        </ul>
      )}
      <label className="flex h-8 items-center gap-2 rounded-md border border-border px-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person" aria-label="Find a person" className="w-full bg-transparent text-[13px] outline-none" /></label>
      <ul aria-label={label} className="mt-1 max-h-36 overflow-y-auto rounded-md border border-border p-1">
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
    </div>
  );
}
