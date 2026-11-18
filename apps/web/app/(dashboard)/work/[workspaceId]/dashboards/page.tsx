"use client";

/* Work → Dashboards (ClickUp style): every dashboard in the workspace you can open, and "New dashboard". */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, Folder, LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { workApi, workKeys, type DashboardRow, type ViewLocation } from "@/services/work.api";

const ICON: Record<ViewLocation, typeof Folder> = { space: LayoutGrid, folder: Folder, list: ListIcon };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const dashboardHref = (ws: string, d: { uid: string; location: { type: ViewLocation; uid: string } }) => `/work/${ws}/${d.location.type}/${d.location.uid}?v=${d.uid}`;

export default function DashboardsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["work", "dashboards", ws], queryFn: () => workApi.dashboards(ws) });
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), staleTime: 30_000 });
  const term = q.trim().toLowerCase();
  const shown = rows.filter((d) => !term || `${d.name} ${d.location.name} ${d.location.path}`.toLowerCase().includes(term));

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9333EA]/12 text-[#9333EA]"><BarChart3 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight">Dashboards</h1>
          <p className="text-[12.5px] text-muted-foreground">Live numbers for your spaces, folders and lists.</p>
        </div>
        <span className="flex-1" />
        <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 sm:w-64">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dashboards" aria-label="Search dashboards" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
        {tree?.access.canEdit && <button type="button" onClick={() => setCreating(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground"><Plus className="h-4 w-4" /> New dashboard</button>}
      </header>

      {isLoading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-muted" /> : !shown.length ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 py-14 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-[14px] font-medium">{term ? "No dashboards match." : "No dashboards yet"}</p>
          {!term && <p className="mt-1 text-[12.5px] text-muted-foreground">A dashboard shows live charts for a space, folder or list.</p>}
          {!term && tree?.access.canEdit && <button type="button" onClick={() => setCreating(true)} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium hover:bg-accent">Create one</button>}
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Location</th>
                <th className="hidden w-[140px] px-4 py-2.5 font-semibold sm:table-cell">Updated</th>
                <th className="w-[90px] px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const I = ICON[d.location.type];
                return (
                  <tr key={d.uid} className="border-b border-border/70 last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={dashboardHref(ws, d)} className="flex items-center gap-2.5 font-medium hover:text-primary">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#9333EA]/10 text-[#9333EA]"><BarChart3 className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block truncate">{d.name}</span>
                          <span className="block truncate text-[11.5px] font-normal text-muted-foreground md:hidden">{d.location.path ? `${d.location.path} / ` : ""}{d.location.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: d.location.color }} />
                        <I className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{d.location.path ? `${d.location.path} / ` : ""}<span className="text-foreground">{d.location.name}</span></span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[12.5px] text-muted-foreground sm:table-cell">{ago(d.updatedAt)}</td>
                    <td className="px-4 py-3 text-right"><Link href={dashboardHref(ws, d)} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium hover:bg-accent">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {creating && tree && <NewDashboardDialog ws={ws} tree={tree} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewDashboardDialog({ ws, tree, onClose }: { ws: string; tree: NonNullable<Awaited<ReturnType<typeof workApi.tree>>>; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const options = useMemo(() => {
    const out: { key: string; type: ViewLocation; uid: string; label: string; depth: number }[] = [];
    for (const sp of tree.spaces) {
      out.push({ key: `space:${sp.uid}`, type: "space", uid: sp.uid, label: sp.name, depth: 0 });
      for (const f of sp.folders) {
        out.push({ key: `folder:${f.uid}`, type: "folder", uid: f.uid, label: f.name, depth: 1 });
        for (const l of f.lists) out.push({ key: `list:${l.uid}`, type: "list", uid: l.uid, label: l.name, depth: 2 });
      }
      for (const l of sp.lists) out.push({ key: `list:${l.uid}`, type: "list", uid: l.uid, label: l.name, depth: 1 });
    }
    return out;
  }, [tree]);
  const [loc, setLoc] = useState(options[0]?.key ?? "");
  const [name, setName] = useState("Dashboard");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    const o = options.find((x) => x.key === loc);
    if (!o || !name.trim()) return;
    setBusy(true);
    try {
      const v = await workApi.createView({ type: o.type, ref: o.uid, kind: "dashboard", name: name.trim() });
      await qc.invalidateQueries({ queryKey: ["work", "dashboards", ws] });
      await qc.invalidateQueries({ queryKey: ["work", "views"] });
      toast.success("Dashboard created");
      onClose();
      router.push(`/work/${ws}/${o.type}/${o.uid}?v=${v.uid}`);
    } catch (e) { toast.error(errMsg(e, "Couldn't create the dashboard.")); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>New dashboard</DialogTitle>
        <DialogDescription>Pick where it lives. It shows live numbers for everything in there.</DialogDescription>
        <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="space-y-3">
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Dashboard name" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13.5px] outline-none focus:border-primary/50" />
          </label>
          <label className="block"><span className="text-[12px] font-medium text-muted-foreground">Location</span>
            <select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Location" className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-[13.5px]">
              {options.map((o) => <option key={o.key} value={o.key}>{"   ".repeat(o.depth)}{o.type === "space" ? "▪ " : o.type === "folder" ? "▸ " : "· "}{o.label}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
            <button type="submit" disabled={busy || !loc || !name.trim()} className={cn("h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground")}>{busy ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
