"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, ChevronRight, Folder, Hash, LayoutGrid, ListChecks, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoCompany, type CeoPlace, type CeoStats } from "@/services/ceo-tower.api";
import { CompanyPanel } from "./CompanyPanel";

function Stats({ s, people }: { s: CeoStats; people?: number }) {
  return (
    <span className="flex items-center gap-3 font-mono text-[11.5px]">
      <span title="Open">{s.open} open</span>
      <span title="Overdue" className={cn(s.overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>{s.overdue} overdue</span>
      <span title="Working on" className="hidden text-muted-foreground sm:inline">{s.inProgress} working</span>
      {people !== undefined && <span className="hidden text-muted-foreground md:inline">{people} people</span>}
      <span className="flex w-28 items-center gap-1.5"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} /></span><span className="w-8 text-right text-muted-foreground">{s.progress}%</span></span>
    </span>
  );
}

/** CEO Tower → Boards / Work: each company's boards, or spaces → folders → lists, with progress */
export function ProductView({ product, company, companies }: { product: "boards" | "work"; company: string | null; companies: CeoCompany[] }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "structure", product, company], queryFn: () => ceoApi.structure(product, company), refetchInterval: 60_000 });
  const [panel, setPanel] = useState<{ company: CeoCompany; place: CeoPlace } | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setClosed((c) => ({ ...c, [k]: !c[k] }));
  const co = (key: string) => companies.find((c) => c.key === key);
  const openPlace = (companyKey: string, place: CeoPlace) => { const c = co(companyKey); if (c) setPanel({ company: c, place }); };

  if (isLoading) return <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!data.length) return <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center text-[13px] text-muted-foreground">You don&apos;t own any {product === "work" ? "Work" : "Boards"} companies{company ? " in this scope" : ""}.</p>;

  const row = (companyKey: string, place: CeoPlace, depth: number, s: CeoStats, people: number, href: string, icon: React.ReactNode, expander?: React.ReactNode, lockedIcon?: boolean) => (
    <li key={`${place.type}-${place.id}`} className="flex items-center gap-2 border-b border-border/60 py-2 pr-4 hover:bg-accent/30" style={{ paddingLeft: 16 + depth * 22 }}>
      {expander ?? <span className="w-4" />}
      <button type="button" onClick={() => openPlace(companyKey, place)} aria-label={`${place.name}: show tasks`} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {icon}<span className={cn("truncate text-[13px]", depth === 0 ? "font-semibold" : "font-medium")}>{place.name}</span>{lockedIcon && <Lock className="h-3 w-3 text-muted-foreground" />}
      </button>
      <Stats s={s} people={people} />
      <Link href={href} aria-label={`Open ${place.name} in ${product === "work" ? "Work" : "Boards"}`} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowUpRight className="h-3.5 w-3.5" /></Link>
    </li>
  );
  const exp = (k: string) => <button type="button" aria-label={closed[k] ? "Expand" : "Collapse"} onClick={() => toggle(k)} className="flex w-4 justify-center text-muted-foreground">{closed[k] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>;

  return (
    <div className="space-y-4">
      {data.map((c: any) => (
        <section key={c.key} aria-label={c.name} className="rounded-2xl border border-border bg-card">
          <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-brass-soft">{product === "work" ? <ListChecks className="h-4.5 w-4.5" /> : <LayoutGrid className="h-4.5 w-4.5" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-serif text-[20px] leading-tight">{c.name}</span><span className="block font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{product === "work" ? `${c.spaces.length} spaces` : `${c.boards.length} boards`}</span></span>
            <Stats s={c.stats} />
            <Link href={product === "work" ? `/work/${c.uid}` : `/workspace/${c.uid}`} className="flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </header>
          <div className={cn(product === "work" && "grid lg:grid-cols-[1fr_260px]")}>
            <ul aria-label={product === "work" ? "Spaces, folders and lists" : "Boards"}>
              {product === "boards"
                ? c.boards.map((b: any) => row(c.key, { type: "board", id: b.id, name: b.name }, 0, b.stats, b.people, b.href, <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />))
                : c.spaces.flatMap((s: any) => {
                    const k = `s${s.id}`;
                    return [
                      row(c.key, { type: "space", id: s.id, name: s.name }, 0, s.stats, s.people, s.href, <span className="h-3 w-3 rounded" style={{ background: s.color }} />, exp(k), s.isPrivate),
                      ...(closed[k] ? [] : [
                        ...s.folders.flatMap((f: any) => {
                          const fk = `f${f.id}`;
                          return [
                            row(c.key, { type: "folder", id: f.id, name: f.name }, 1, f.stats, f.people, f.href, <Folder className="h-3.5 w-3.5 text-muted-foreground" />, f.lists.length ? exp(fk) : undefined),
                            ...(closed[fk] ? [] : f.lists.map((l: any) => row(c.key, { type: "list", id: l.id, name: l.name }, 2, l.stats, l.people, l.href, <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />))),
                          ];
                        }),
                        ...s.lists.map((l: any) => row(c.key, { type: "list", id: l.id, name: l.name }, 1, l.stats, l.people, l.href, <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />)),
                      ]),
                    ];
                  })}
              {(product === "boards" ? !c.boards.length : !c.spaces.length) && <li className="px-5 py-6 text-[12.5px] text-muted-foreground">Nothing here yet.</li>}
            </ul>
            {product === "work" && (
              <aside aria-label="Most active channels" className="border-t border-border p-4 lg:border-l lg:border-t-0">
                <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Most active channels · 7 days</h3>
                {!c.channels.length ? <p className="text-[12.5px] text-muted-foreground">No channel messages this week.</p> : (
                  <ul className="space-y-1">
                    {c.channels.map((ch: any) => <li key={ch.href}><Link href={ch.href} className="flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] hover:bg-accent"><Hash className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{ch.name.replace(/^#/, "")}</span><span className="font-mono text-[11px] text-muted-foreground">{ch.messages}</span></Link></li>)}
                  </ul>
                )}
              </aside>
            )}
          </div>
        </section>
      ))}
      {panel && <CompanyPanel company={panel.company} place={panel.place} start={{ tab: "tasks", state: "open" }} workCompanies={companies.filter((c) => c.source === "work")} onClose={() => setPanel(null)} />}
    </div>
  );
}
