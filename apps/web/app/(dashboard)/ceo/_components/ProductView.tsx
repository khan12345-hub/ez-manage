"use client";

/*
 * Executive Hub → Accounts & Invoices / Company Work: an explorer for many companies, spaces,
 * folders, lists and boards. Left: a compact tree (search, overdue badges). Right: the selected
 * place — breadcrumb, its numbers, and what is inside it as cards or a table, sorted and filtered.
 * Clicking a place with things inside drills in; a list or board opens its tasks.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, Building2, ChevronDown, ChevronRight, Folder, FolderOpen, Hash, LayoutGrid, List as ListIcon,
  ListChecks, Lock, Rows3, Search, SquareKanban, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoCompany, type CeoPlace, type CeoStats } from "@/services/ceo-tower.api";
import { CompanyPanel } from "./CompanyPanel";
import { PRODUCT_NAME } from "@/lib/products";

type Kind = "root" | "company" | "space" | "folder" | "list" | "board";
type Node = {
  id: string; kind: Kind; name: string; stats: CeoStats; people?: number; href?: string; color?: string; isPrivate?: boolean;
  companyKey?: string; place?: CeoPlace; children: Node[]; channels?: { name: string; href: string; messages: number }[];
};
type Sort = "overdue" | "behind" | "open" | "name";
type Filter = "all" | "overdue" | "behind";

const ZERO: CeoStats = { total: 0, open: 0, done: 0, inProgress: 0, overdue: 0, doneWeek: 0, progress: 0 } as CeoStats;
const n_ = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const KIND_LABEL: Record<Kind, string> = { root: "Companies", company: "Company", space: "Space", folder: "Folder", list: "List", board: "Board" };

/** server structure → one tree */
function buildTree(data: any[], product: "boards" | "work"): Node {
  const companies: Node[] = data.map((c) => {
    const ck = c.key as string;
    const list = (l: any): Node => ({ id: `l${l.id}`, kind: "list", name: l.name, stats: l.stats, people: l.people, href: l.href, companyKey: ck, place: { type: "list", id: l.id, name: l.name }, children: [] });
    const children: Node[] = product === "boards"
      ? (c.boards ?? []).map((b: any) => ({ id: `b${b.id}`, kind: "board", name: b.name, stats: b.stats, people: b.people, href: b.href, companyKey: ck, place: { type: "board", id: b.id, name: b.name }, children: [] }))
      : (c.spaces ?? []).map((s: any) => ({
          id: `s${s.id}`, kind: "space", name: s.name, stats: s.stats, people: s.people, href: s.href, color: s.color, isPrivate: s.isPrivate, companyKey: ck,
          place: { type: "space", id: s.id, name: s.name },
          children: [
            ...(s.folders ?? []).map((f: any) => ({ id: `f${f.id}`, kind: "folder" as const, name: f.name, stats: f.stats, people: f.people, href: f.href, companyKey: ck, place: { type: "folder", id: f.id, name: f.name }, children: (f.lists ?? []).map(list) })),
            ...(s.lists ?? []).map(list),
          ],
        }));
    return { id: ck, kind: "company", name: c.name, stats: c.stats, href: product === "work" ? `/work/${c.uid}` : `/workspace/${c.uid}`, companyKey: ck, children, channels: c.channels };
  });
  const sum = (k: keyof CeoStats) => companies.reduce((n, c) => n + (Number(c.stats?.[k]) || 0), 0);
  const total = sum("total"), done = sum("done");
  return { id: "root", kind: "root", name: "All companies", children: companies, stats: { ...ZERO, total, done, open: sum("open"), inProgress: sum("inProgress"), overdue: sum("overdue"), doneWeek: sum("doneWeek"), progress: total ? Math.round((done / total) * 100) : 0 } };
}

function index(root: Node) {
  const byId = new Map<string, Node>(); const parent = new Map<string, string>();
  const walk = (n: Node) => { byId.set(n.id, n); for (const c of n.children) { parent.set(c.id, n.id); walk(c); } };
  walk(root);
  const path = (id: string) => { const out: Node[] = []; let cur: string | undefined = id; while (cur) { const n = byId.get(cur); if (!n) break; out.unshift(n); cur = parent.get(cur); } return out; };
  return { byId, path };
}

const countInside = (n: Node) => {
  let folders = 0, lists = 0;
  const walk = (x: Node) => { for (const c of x.children) { if (c.kind === "folder" || c.kind === "space") folders++; if (c.kind === "list" || c.kind === "board") lists++; walk(c); } };
  walk(n);
  return { folders, lists };
};

function NodeIcon({ n, open, className }: { n: Node; open?: boolean; className?: string }) {
  const cls = cn("h-4 w-4 shrink-0", className);
  if (n.kind === "company") return <Building2 className={cn(cls, "text-[#b08d57]")} />;
  if (n.kind === "space") return <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white", className)} style={{ background: n.color ?? "#047857" }}>{n.name[0]?.toUpperCase()}</span>;
  if (n.kind === "folder") return open ? <FolderOpen className={cn(cls, "text-muted-foreground")} /> : <Folder className={cn(cls, "text-muted-foreground")} />;
  if (n.kind === "board") return <SquareKanban className={cn(cls, "text-product-boards dark:text-[#a5b4fc]")} />;
  return <ListChecks className={cn(cls, "text-muted-foreground")} />;
}

function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.span className="block h-full rounded-full bg-[#047857] dark:bg-[#059669]" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
    </span>
  );
}

/** progress ring for the selected place */
function Ring({ value }: { value: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" role="img" aria-label={`${value}% done`}>
      <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
      <motion.circle cx="32" cy="32" r={r} className="fill-none stroke-[#047857] dark:stroke-[#059669]" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      <text x="32" y="36" textAnchor="middle" className="rotate-90 fill-foreground text-[13px] font-bold" style={{ transformOrigin: "32px 32px" }}>{value}%</text>
    </svg>
  );
}

export function ProductView({ product, company, companies }: { product: "boards" | "work"; company: string | null; companies: CeoCompany[] }) {
  const reduced = useReducedMotion();
  const { data = [], isLoading } = useQuery({ queryKey: ["ceo-tower", "structure", product, company], queryFn: () => ceoApi.structure(product, company), refetchInterval: 60_000 });
  const root = useMemo(() => buildTree(data, product), [data, product]);
  const { byId, path } = useMemo(() => index(root), [root]);
  const [sel, setSel] = useState("root");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("overdue");
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<"cards" | "table">("cards");
  const [panel, setPanel] = useState<{ company: CeoCompany; place: CeoPlace } | null>(null);

  // one company only: start inside it (once — "All companies" stays reachable from the breadcrumb)
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current || !data.length) return;
    picked.current = true;
    if (root.children.length === 1) { const only = root.children[0]!; setSel(only.id); setOpen((o) => ({ ...o, [only.id]: true })); }
  }, [data.length, root]);
  const current = byId.get(sel) ?? root;
  const crumbs = path(current.id);
  const name = product === "work" ? PRODUCT_NAME.work : PRODUCT_NAME.boards;
  const co = (key?: string) => companies.find((c) => c.key === key);
  const showTasks = (n: Node) => { const c = co(n.companyKey); if (c && n.place) setPanel({ company: c, place: n.place }); else if (c) setPanel({ company: c, place: undefined as unknown as CeoPlace }); };
  const go = (n: Node) => {
    if (n.children.length) {
      setSel(n.id);
      // open the tree down to it
      setOpen((o) => { const x = { ...o }; for (const p of path(n.id)) x[p.id] = true; return x; });
    } else showTasks(n);
  };

  // search: matching places anywhere (with their path); the tree keeps only branches with a match
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return null;
    const out: Node[] = [];
    const walk = (n: Node) => { for (const c of n.children) { if (c.name.toLowerCase().includes(needle)) out.push(c); walk(c); } };
    walk(root);
    return out;
  }, [needle, root]);
  const keep = useMemo(() => {
    if (!matches) return null;
    const s = new Set<string>();
    for (const m of matches) for (const p of path(m.id)) s.add(p.id);
    return s;
  }, [matches, path]);

  const shown = useMemo(() => {
    let list = matches ?? current.children;
    if (filter === "overdue") list = list.filter((n) => n.stats.overdue > 0);
    if (filter === "behind") list = list.filter((n) => n.stats.open > 0 && n.stats.progress < 40);
    const by: Record<Sort, (a: Node, b: Node) => number> = {
      overdue: (a, b) => b.stats.overdue - a.stats.overdue || b.stats.open - a.stats.open,
      behind: (a, b) => a.stats.progress - b.stats.progress || b.stats.open - a.stats.open,
      open: (a, b) => b.stats.open - a.stats.open,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [matches, current, filter, sort]);

  if (isLoading) return <div className="grid gap-4 lg:grid-cols-[300px_1fr]"><div className="h-[520px] animate-pulse rounded-[24px] bg-muted" /><div className="h-[520px] animate-pulse rounded-[24px] bg-muted" /></div>;
  if (!data.length) return <p className="rounded-[24px] border border-dashed border-border bg-card px-6 py-14 text-center text-[13px] text-muted-foreground">You don&apos;t own any {name} companies{company ? " in this scope" : ""}.</p>;

  const glass = "rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_48px_-28px_rgba(11,42,31,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

  // ── left tree ──
  const TreeRow = ({ n, depth }: { n: Node; depth: number }) => {
    if (keep && !keep.has(n.id)) return null;
    const isOpen = !!keep || !!open[n.id];
    const on = sel === n.id;
    const hasKids = n.children.length > 0;
    return (
      <li>
        <div className={cn("group flex items-center gap-1 rounded-xl pr-1.5 transition-colors", on ? "bg-forest text-white dark:bg-primary dark:text-primary-foreground" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]")} style={{ paddingLeft: 4 + depth * 14 }}>
          <button type="button" aria-label={hasKids ? (isOpen ? `Collapse ${n.name}` : `Expand ${n.name}`) : undefined} disabled={!hasKids} onClick={() => setOpen((o) => ({ ...o, [n.id]: !o[n.id] }))}
            className={cn("flex h-6 w-5 shrink-0 items-center justify-center rounded", on ? "text-white/70" : "text-muted-foreground", !hasKids && "invisible")}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => go(n)} title={n.name} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
            <NodeIcon n={n} open={isOpen} className={on ? "!text-brass-soft" : undefined} />
            <span className={cn("min-w-0 flex-1 truncate text-[13px]", n.kind === "company" ? "font-semibold" : "font-medium")}>{n.name}</span>
            {n.isPrivate && <Lock className="h-3 w-3 shrink-0 opacity-60" />}
            {n.stats.overdue > 0 && <span className={cn("shrink-0 rounded-full px-1.5 text-[10.5px] font-bold leading-[18px] tabular-nums", on ? "bg-white/20 text-white" : "bg-[#dc2626]/10 text-[#dc2626] dark:bg-[#ef4444]/15 dark:text-[#f87171]")} title={`${n.stats.overdue} overdue`}>{n.stats.overdue}</span>}
          </button>
        </div>
        {hasKids && isOpen && <ul>{n.children.map((c) => <TreeRow key={c.id} n={c} depth={depth + 1} />)}</ul>}
      </li>
    );
  };

  const inside = countInside(current);
  const s = current.stats;
  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* tree */}
      <aside aria-label={`${name} places`} className={cn(glass, "hidden max-h-[calc(100vh-150px)] flex-col p-3 lg:sticky lg:top-[104px] lg:flex")}>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={product === "work" ? "Find a space, folder or list" : "Find a board"} aria-label="Find a place" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </label>
        <div className="mt-2 flex items-center gap-2 px-1 text-[11.5px] text-muted-foreground">
          <button type="button" onClick={() => { setSel("root"); setQ(""); }} className={cn("font-semibold hover:text-foreground", sel === "root" && "text-foreground")}>All companies</button>
          <span className="flex-1" />
          <button type="button" onClick={() => { const x: Record<string, boolean> = {}; byId.forEach((_, k) => (x[k] = true)); setOpen(x); }} className="hover:text-foreground">Expand all</button>
          <span aria-hidden>·</span>
          <button type="button" onClick={() => setOpen({})} className="hover:text-foreground">Collapse</button>
        </div>
        <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {root.children.map((c) => <TreeRow key={c.id} n={c} depth={0} />)}
          {keep && !matches?.length && <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">Nothing matches “{q}”.</li>}
        </ul>
      </aside>

      {/* selected place */}
      <section aria-label={current.name} className="min-w-0 space-y-4">
        <div className={cn(glass, "p-5")}>
          {/* breadcrumb */}
          <nav aria-label="Path" className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                <button type="button" onClick={() => setSel(c.id)} className={cn("max-w-[220px] truncate rounded-md px-1.5 py-0.5 hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/5", i === crumbs.length - 1 && "font-semibold text-foreground")}>{c.name}</button>
              </span>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Ring value={s.progress} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><NodeIcon n={current.kind === "root" ? { ...current, kind: "company" } : current} /><span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{current.kind === "root" ? name : KIND_LABEL[current.kind]}</span></span>
              <h2 className="mt-0.5 truncate text-[22px] font-semibold tracking-tight">{current.kind === "root" ? `All ${name} companies` : current.name}</h2>
              <span className="text-[12.5px] text-muted-foreground">
                {current.kind === "root" ? `${root.children.length} ${root.children.length === 1 ? "company" : "companies"} · ` : ""}
                {product === "work" ? `${n_(inside.folders, "space or folder", "spaces & folders")} · ${n_(inside.lists, "list", "lists")}` : n_(inside.lists, "board", "boards")}
                {current.people !== undefined && ` · ${current.people} people`}
              </span>
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              {([["Open", s.open, ""], ["Overdue", s.overdue, s.overdue ? "text-[#dc2626] dark:text-[#f87171]" : ""], ["Working", s.inProgress, ""]] as const).map(([l, v, cls]) => (
                <span key={l} className="min-w-[78px] rounded-2xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]"><span className={cn("block text-[20px] font-bold leading-none tabular-nums", cls)}>{v}</span><span className="mt-1 block text-[11px] text-muted-foreground">{l}</span></span>
              ))}
            </div>
            <div className="flex gap-2">
              {current.kind !== "root" && <button type="button" onClick={() => showTasks(current)} className="flex h-9 items-center gap-1.5 rounded-xl bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><ListChecks className="h-4 w-4" /> Tasks</button>}
              {current.href && <Link href={current.href} className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-semibold hover:bg-accent">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            </div>
          </div>
        </div>

        {/* phone: no tree, so search lives here */}
        <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 lg:hidden">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a place" aria-label="Find a place" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
        </label>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-1 text-[14px] font-semibold">{matches ? `${matches.length} found for “${q}”` : current.kind === "root" ? "Companies" : product === "work" && current.kind === "company" ? "Spaces" : current.kind === "company" ? "Boards" : "Inside"}</h3>
          <div role="group" aria-label="Show" className="flex rounded-xl border border-border bg-card p-0.5 text-[12px]">
            {([["all", "All"], ["overdue", "Has overdue"], ["behind", "Behind (<40%)"]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("rounded-lg px-2.5 py-1 font-medium", filter === k ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
          </div>
          <span className="flex-1" />
          <label className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-card px-2 text-[12px] text-muted-foreground">Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="bg-transparent font-medium text-foreground outline-none">
              <option value="overdue">Most overdue</option><option value="behind">Least progress</option><option value="open">Most open</option><option value="name">Name</option>
            </select>
          </label>
          <div role="group" aria-label="Layout" className="flex rounded-xl border border-border bg-card p-0.5">
            <button type="button" aria-label="Cards" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")} className={cn("rounded-lg p-1.5", layout === "cards" ? "bg-accent text-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Table" aria-pressed={layout === "table"} onClick={() => setLayout("table")} className={cn("rounded-lg p-1.5", layout === "table" ? "bg-accent text-foreground" : "text-muted-foreground")}><Rows3 className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {!shown.length ? (
          <p className={cn(glass, "px-6 py-12 text-center text-[13px] text-muted-foreground")}>{filter !== "all" ? "Nothing here matches this filter. 👏" : matches ? "Nothing matches." : "Nothing inside yet."}</p>
        ) : layout === "cards" ? (
          <motion.ul key={`${current.id}-${filter}-${sort}-${needle}`} initial={reduced ? false : "hidden"} animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }} className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((n) => {
              const c = countInside(n);
              const where = matches ? path(n.id).slice(1, -1).map((p) => p.name).join(" › ") : null;
              return (
                <motion.li key={n.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={reduced ? undefined : { y: -2 }}>
                  <div className={cn(glass, "flex h-full flex-col p-4", n.stats.overdue > 0 && "ring-1 ring-[#dc2626]/20")}>
                    <button type="button" onClick={() => go(n)} className="flex items-start gap-3 text-left">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] dark:bg-white/[0.06]"><NodeIcon n={n} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-semibold">{n.name}</span>{n.isPrivate && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">{where ?? KIND_LABEL[n.kind]}{n.children.length ? ` · ${product === "work" && n.kind !== "folder" ? `${n_(c.folders, "folder", "folders")} · ` : ""}${product === "work" ? n_(c.lists, "list", "lists") : n_(c.lists, "board", "boards")}` : ""}</span>
                      </span>
                      {n.children.length > 0 && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>
                    <div className="mt-3 flex items-center gap-2"><Progress value={n.stats.progress} className="flex-1" /><span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{n.stats.progress}%</span></div>
                    <div className="mt-3 flex items-center gap-3 text-[12px]">
                      <span><b className="tabular-nums">{n.stats.open}</b> <span className="text-muted-foreground">open</span></span>
                      <span className={cn(n.stats.overdue ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{n.stats.overdue > 0 && <AlertTriangle className="mr-0.5 inline h-3 w-3 -translate-y-px" />}{n.stats.overdue} late</span>
                      <span className="text-muted-foreground">{n.stats.inProgress} working</span>
                      {n.people !== undefined && <span className="ml-auto flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />{n.people}</span>}
                    </div>
                    <div className="mt-3 flex gap-1.5 border-t border-border/60 pt-3">
                      <button type="button" onClick={() => showTasks(n)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-primary hover:bg-primary/10"><ListChecks className="h-3.5 w-3.5" /> Tasks</button>
                      {n.children.length > 0 && <button type="button" onClick={() => go(n)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"><FolderOpen className="h-3.5 w-3.5" /> Inside</button>}
                      {n.href && <Link href={n.href} className="ml-auto flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        ) : (
          <div className={cn(glass, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead className="bg-black/[0.02] text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.03]">
                  <tr><th className="px-4 py-2.5">Name</th><th className="px-3 py-2.5 text-right">Open</th><th className="px-3 py-2.5 text-right">Late</th><th className="px-3 py-2.5 text-right">Working</th><th className="w-[180px] px-3 py-2.5">Progress</th><th className="px-3 py-2.5" aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {shown.map((n) => (
                    <tr key={n.id} className="border-t border-border/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => go(n)} className="flex min-w-0 items-center gap-2 text-left">
                          <NodeIcon n={n} /><span className="min-w-0"><span className="block truncate font-medium">{n.name}</span>{matches && <span className="block truncate text-[11px] text-muted-foreground">{path(n.id).slice(1, -1).map((p) => p.name).join(" › ")}</span>}</span>
                          {n.children.length > 0 && <span className="shrink-0 text-[11px] text-muted-foreground">({n.children.length})</span>}
                        </button>
                      </td>
                      <td className="px-3 text-right tabular-nums">{n.stats.open}</td>
                      <td className={cn("px-3 text-right tabular-nums", n.stats.overdue ? "font-semibold text-[#dc2626] dark:text-[#f87171]" : "text-muted-foreground")}>{n.stats.overdue}</td>
                      <td className="px-3 text-right tabular-nums text-muted-foreground">{n.stats.inProgress}</td>
                      <td className="px-3"><span className="flex items-center gap-2"><Progress value={n.stats.progress} className="flex-1" /><span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{n.stats.progress}%</span></span></td>
                      <td className="whitespace-nowrap px-3 text-right">
                        <button type="button" onClick={() => showTasks(n)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary/10">Tasks</button>
                        {n.href && <Link href={n.href} aria-label={`Open ${n.name}`} className="ml-1 inline-flex rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><ArrowUpRight className="h-3.5 w-3.5" /></Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Work company: where people talk */}
        <AnimatePresence>
          {product === "work" && current.kind === "company" && !!current.channels?.length && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn(glass, "p-4")}>
              <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Most active channels · 7 days</h3>
              <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {current.channels.map((ch) => <li key={ch.href}><Link href={ch.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-accent"><ListIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{ch.name.replace(/^#/, "")}</span><span className="text-[11px] tabular-nums text-muted-foreground">{ch.messages} msgs</span></Link></li>)}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {panel && <CompanyPanel company={panel.company} place={panel.place} start={{ tab: "tasks", state: "open" }} workCompanies={companies.filter((c) => c.source === "work")} onClose={() => setPanel(null)} />}
    </div>
  );
}
