"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, CircleDot, Folder, FolderPlus, LayoutGrid, List as ListIcon, ListPlus, Lock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { workApi, workKeys, type WorkOverview, type WorkOverviewList } from "@/services/work.api";
import { NameDialog } from "./NameDialog";

/** Space / Folder overview (opened by clicking a space or folder in the sidebar). */
export function OverviewPage({ kind, uid, workspaceId }: { kind: "space" | "folder"; uid: string; workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["work", "overview", kind, uid];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => (kind === "space" ? workApi.spaceOverview(uid) : workApi.folderOverview(uid)),
  });
  const [q, setQ] = useState("");
  const [layout, setLayout] = useState<"cards" | "rows">("cards");
  const [dialog, setDialog] = useState<null | "list" | "folder">(null);

  if (isError) return <div className="p-10 text-center text-sm text-muted-foreground">This {kind} doesn&apos;t exist, was archived, or you don&apos;t have access.</div>;
  if (isLoading || !data) return <div className="space-y-3 p-8">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>;

  const term = q.trim().toLowerCase();
  const lists = data.lists.filter((l) => !term || `${l.name} ${l.folder?.name ?? ""}`.toLowerCase().includes(term));
  const totals = data.lists.reduce((a, l) => ({ total: a.total + l.total, done: a.done + l.done, overdue: a.overdue + l.overdue }), { total: 0, done: 0, overdue: 0 });
  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;
  const title = kind === "space" ? data.space.name : data.folder!.name;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: workKeys.tree(workspaceId) });
  };

  // group by folder on a space overview
  const groups: { title: string | null; folderUid?: string; lists: WorkOverviewList[] }[] =
    kind === "folder"
      ? [{ title: null, lists }]
      : ([
          ...data.folders.map((f) => ({ title: f.name, folderUid: f.uid, lists: lists.filter((l) => l.folder?.id === f.id) })),
          { title: data.folders.length ? "Lists" : null, lists: lists.filter((l) => !l.folder) },
        ] as { title: string | null; folderUid?: string; lists: WorkOverviewList[] }[]).filter((g) => g.lists.length || (g.folderUid && !term));

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="relative border-b border-border bg-card px-4 pb-4 pt-4 sm:px-8">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${data.space.color} 0%, var(--brass) 60%, transparent 100%)` }} />
        <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden /> Work
          <span aria-hidden>/</span>
          {kind === "folder" ? (
            <Link href={`/work/${workspaceId}/space/${data.space.uid}`} className="normal-case tracking-normal hover:text-foreground">{data.space.name}</Link>
          ) : (
            <span className="normal-case tracking-normal">Space</span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-center gap-2.5 font-serif text-[32px] leading-tight tracking-tight">
            {kind === "space" ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg font-sans text-[15px] font-bold text-white" style={{ background: data.space.color }}>{title[0]?.toUpperCase()}</span>
            ) : (
              <Folder className="h-7 w-7 text-muted-foreground" />
            )}
            {title}
            {data.space.isPrivate && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private" />}
          </h1>
          {data.access.canManage && (
            <div className="flex gap-2">
              {kind === "space" && (
                <button type="button" onClick={() => setDialog("folder")} className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                  <FolderPlus className="h-3.5 w-3.5" /> New folder
                </button>
              )}
              <button type="button" onClick={() => setDialog("list")} className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
                <ListPlus className="h-3.5 w-3.5" /> New list
              </button>
            </div>
          )}
        </div>

        {/* summary */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={ListIcon} label="Lists" value={data.lists.length} />
          <Stat icon={CircleDot} label="Open tasks" value={totals.total - totals.done} />
          <Stat icon={CheckCircle2} label="Done" value={`${totals.done} · ${pct}%`} />
          <Stat icon={CalendarClock} label="Overdue" value={totals.overdue} alert={totals.overdue > 0} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 pt-4 sm:px-8">
        <label className="flex h-8 w-[260px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lists" aria-label="Search lists" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
        <span className="flex-1" />
        <div className="flex rounded-md border border-border p-0.5">
          <button type="button" aria-label="Cards" aria-pressed={layout === "cards"} onClick={() => setLayout("cards")} className={cn("rounded p-1", layout === "cards" ? "bg-accent text-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Rows" aria-pressed={layout === "rows"} onClick={() => setLayout("rows")} className={cn("rounded p-1", layout === "rows" ? "bg-accent text-foreground" : "text-muted-foreground")}><ListIcon className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-6 px-4 py-4 sm:px-8">
        {groups.map((g) => (
          <section key={g.folderUid ?? g.title ?? "lists"} aria-label={g.title ?? "Lists"}>
            {g.title && (
              <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
                {g.folderUid ? <Folder className="h-4 w-4 text-muted-foreground" /> : <ListIcon className="h-4 w-4 text-muted-foreground" />}
                {g.folderUid ? <Link href={`/work/${workspaceId}/folder/${g.folderUid}`} className="hover:text-primary">{g.title}</Link> : g.title}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">{g.lists.length}</span>
              </h2>
            )}
            {g.lists.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-[13px] text-muted-foreground">No lists yet.</p>
            ) : layout === "cards" ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.lists.map((l) => <ListCard key={l.id} l={l} onOpen={() => router.push(`/work/${workspaceId}/list/${l.uid}`)} />)}
              </ul>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {g.lists.map((l) => {
                  const p = l.total ? Math.round((l.done / l.total) * 100) : 0;
                  return (
                    <li key={l.id}>
                      <button type="button" onClick={() => router.push(`/work/${workspaceId}/list/${l.uid}`)} className="grid w-full grid-cols-[minmax(200px,1fr)_120px_90px_90px] items-center gap-3 border-b border-border/70 px-4 py-2.5 text-left text-[13.5px] last:border-b-0 hover:bg-accent/30">
                        <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color ?? data.space.color }} /><span className="truncate font-medium">{l.name}</span></span>
                        <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{ width: `${p}%` }} /></span><span className="w-8 text-right font-mono text-[11px] text-muted-foreground">{p}%</span></span>
                        <span className="text-[12.5px] text-muted-foreground">{l.open} open</span>
                        <span className={cn("text-[12.5px]", l.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{l.overdue} overdue</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
        {groups.length === 0 && <p className="py-16 text-center text-[13px] text-muted-foreground">{term ? "No lists match." : "No lists yet."}</p>}
      </div>

      <NameDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === "folder" ? "New folder" : "New list"}
        description={`In ${data.space.name}${data.folder ? ` / ${data.folder.name}` : ""}`}
        placeholder={dialog === "folder" ? "e.g. Campaigns" : "e.g. Q4 Launch"}
        onSubmit={async (r) => {
          if (dialog === "folder") {
            await workApi.createFolder(data.space.id, r.name);
            refresh();
          } else {
            const list = await workApi.createList(data.space.id, { name: r.name, folderId: data.folder?.id });
            refresh();
            router.push(`/work/${workspaceId}/list/${list.uid}`);
          }
        }}
      />
    </div>
  );
}

function Stat({ icon: I, label, value, alert }: { icon: typeof ListIcon; label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", alert ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}><I className="h-4 w-4" /></span>
      <span>
        <span className={cn("block text-[17px] font-semibold leading-tight", alert && "text-destructive")}>{value}</span>
        <span className="block text-[11.5px] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function ListCard({ l, onOpen }: { l: WorkOverviewList; onOpen: () => void }) {
  const p = l.total ? Math.round((l.done / l.total) * 100) : 0;
  return (
    <li>
      <button type="button" onClick={onOpen} className="group flex w-full flex-col rounded-xl border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgb(11_42_31/0.04)] transition-shadow hover:shadow-[0_8px_24px_-16px_rgb(11_42_31/0.35)]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color ?? "var(--primary)" }} />
          <span className="truncate text-[14.5px] font-semibold group-hover:text-primary">{l.name}</span>
        </span>
        <span className="mt-3 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${p}%` }} /></span>
          <span className="font-mono text-[11px] text-muted-foreground">{p}%</span>
        </span>
        <span className="mt-2.5 flex gap-3 text-[12px] text-muted-foreground">
          <span>{l.open} open</span>
          <span>{l.done} done</span>
          {l.overdue > 0 && <span className="font-medium text-destructive">{l.overdue} overdue</span>}
        </span>
      </button>
    </li>
  );
}

export type { WorkOverview };
