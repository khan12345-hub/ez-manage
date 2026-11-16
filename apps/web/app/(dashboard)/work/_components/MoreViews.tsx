"use client";

/* More list views (ClickUp "+ View"): Activity, Mind Map, Map, Collection (files) and Embeds. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileText, MapPin, MessageSquare, Minus, Plus, Download } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkField, type FieldValues, type WorkListDetail, type WorkTask, type WorkUser } from "@/services/work.api";
import { ActivityRow } from "./TaskDetailSections";
import { Avatar, StatusGlyph } from "./primitives";
import { FieldEditor, fieldsKey } from "./CustomFields";

const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const ago = (iso: string) => {
  const s = Math.round((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// ───────────────────────── Activity ─────────────────────────

type FeedItem =
  | { kind: "activity"; id: number; action: string; fromValue: unknown; toValue: unknown; createdAt: string; user: WorkUser; task: { uid: string; name: string } }
  | { kind: "comment"; id: number; content: string; createdAt: string; user: WorkUser; task: { uid: string; name: string } };

/** Activity view: a live feed of everything that happens in the list */
export function ActivityView({ listUid, members, onOpenTask }: { listUid: string; members: WorkUser[]; onOpenTask: (uid: string) => void }) {
  const q = useInfiniteQuery({
    queryKey: ["work", "list-activity", listUid],
    initialPageParam: "" as string,
    queryFn: async ({ pageParam }) => (await api.get<{ items: FeedItem[]; next: string | null }>(`/work/lists/${listUid}/activity`, { params: pageParam ? { before: pageParam } : {} })).data,
    getNextPageParam: (p) => p.next ?? undefined,
    refetchInterval: 20_000,
  });
  const items = (q.data?.pages ?? []).flatMap((p) => p.items);
  if (q.isLoading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>;
  if (!items.length) return <p className="py-16 text-center text-[13px] text-muted-foreground">Nothing has happened in this list yet.</p>;
  return (
    <section aria-label="Activity" className="mx-auto max-w-3xl">
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={`${it.kind}${it.id}`} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <button type="button" onClick={() => onOpenTask(it.task.uid)} className="mb-1 block max-w-full truncate text-left text-[13px] font-semibold hover:text-primary">{it.task.name}</button>
            {it.kind === "activity" ? (
              <ul><ActivityRow a={{ id: it.id, action: it.action, fromValue: it.fromValue, toValue: it.toValue, createdAt: it.createdAt, user: it.user }} members={members} /></ul>
            ) : (
              <p className="flex items-start gap-2.5 pl-1.5 text-[12.5px] text-muted-foreground">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1"><strong className="font-semibold text-foreground/80">{userName(it.user)}</strong> commented: <span className="text-foreground">{plain(it.content).slice(0, 240)}</span></span>
                <span className="shrink-0 text-[11px]">{ago(it.createdAt)}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <button type="button" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} className="rounded-md border border-border px-3 py-1.5 text-[12.5px] hover:bg-accent disabled:opacity-50">{q.isFetchingNextPage ? "Loading…" : "Show older"}</button>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Mind Map ─────────────────────────

const NODE_W = 220, NODE_H = 40, COL = 280, ROW = 52;

/** Mind Map view: the list in the middle-left, tasks branching out, subtasks after them */
export function MindMapView({ list, tasks, canEdit, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; canEdit: boolean; onOpenTask: (uid: string) => void }) {
  const qc = useQueryClient();
  const [zoom, setZoom] = useState(1);
  const [adding, setAdding] = useState<{ parentId: number | null; name: string } | null>(null);
  const layout = useMemo(() => {
    const roots = tasks.filter((t) => !t.parentId || !tasks.some((x) => x.id === t.parentId));
    const kids = (id: number) => tasks.filter((t) => t.parentId === id);
    const nodes: { t: WorkTask; x: number; y: number; depth: number }[] = [];
    let row = 0;
    const place = (t: WorkTask, depth: number): number => {
      const ch = kids(t.id);
      if (!ch.length) { const y = row++ * ROW; nodes.push({ t, x: (depth + 1) * COL, y, depth }); return y; }
      const ys = ch.map((c) => place(c, depth + 1));
      const y = (ys[0]! + ys[ys.length - 1]!) / 2;
      nodes.push({ t, x: (depth + 1) * COL, y, depth });
      return y;
    };
    const rootYs = roots.map((r) => place(r, 0));
    const rootY = rootYs.length ? (rootYs[0]! + rootYs[rootYs.length - 1]!) / 2 : 0;
    const height = Math.max(row, 1) * ROW;
    const width = (Math.max(0, ...nodes.map((n) => n.depth)) + 2) * COL;
    return { nodes, rootY, height, width };
  }, [tasks]);
  const pos = new Map(layout.nodes.map((n) => [n.t.id, n]));
  const status = (t: WorkTask) => list.statuses.find((s) => s.id === t.statusId);
  const add = async () => {
    if (!adding?.name.trim()) { setAdding(null); return; }
    try {
      await workApi.createTask(list.id, { name: adding.name.trim(), ...(adding.parentId ? { parentId: adding.parentId } : {}) } as any);
      await qc.invalidateQueries({ queryKey: workKeys.tasks(list.id) });
    } catch (e) { toast.error(errMsg(e, "Couldn't add the task.")); }
    setAdding(null);
  };
  const edge = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
  return (
    <section aria-label="Mind map" className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-popover p-0.5 shadow-sm">
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="rounded p-1 hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
        <span className="w-10 text-center font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} className="rounded p-1 hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <div className="max-h-[calc(100vh-260px)] min-h-[420px] overflow-auto p-6">
        <div className="relative origin-top-left" style={{ width: layout.width, height: Math.max(layout.height, 120), transform: `scale(${zoom})` }}>
          <svg aria-hidden className="absolute inset-0" width={layout.width} height={Math.max(layout.height, 120)}>
            {layout.nodes.map((n) => {
              const parent = n.t.parentId ? pos.get(n.t.parentId) : null;
              const x1 = parent ? parent.x + NODE_W : NODE_W, y1 = (parent ? parent.y : layout.rootY) + NODE_H / 2;
              return <path key={n.t.id} d={edge(x1, y1, n.x, n.y + NODE_H / 2)} fill="none" stroke="var(--border)" strokeWidth={2} />;
            })}
          </svg>
          <div className="absolute flex items-center gap-2 rounded-xl bg-primary px-3 text-[14px] font-semibold text-primary-foreground shadow-sm" style={{ left: 0, top: layout.rootY, width: NODE_W, height: NODE_H }}>
            <span className="truncate">{list.name}</span>
            {canEdit && <button type="button" aria-label="Add a task" title="Add a task" onClick={() => setAdding({ parentId: null, name: "" })} className="ml-auto rounded-md p-1 hover:bg-white/15"><Plus className="h-3.5 w-3.5" /></button>}
          </div>
          {layout.nodes.map(({ t, x, y }) => (
            <div key={t.id} className="group absolute flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 shadow-[0_1px_2px_rgb(11_42_31/0.06)] hover:border-primary/50" style={{ left: x, top: y, width: NODE_W, height: NODE_H, borderLeftColor: status(t)?.color, borderLeftWidth: 3 }}>
              <StatusGlyph status={status(t)} size={13} />
              <button type="button" onClick={() => onOpenTask(t.uid)} className={cn("min-w-0 flex-1 truncate text-left text-[13px] hover:text-primary", t.completedAt && "text-muted-foreground line-through")}>{t.name}</button>
              {t.assignees[0] && <Avatar user={t.assignees[0]} size={18} />}
              {canEdit && !t.parentId && <button type="button" aria-label={`Add a subtask to ${t.name}`} title="Add subtask" onClick={() => setAdding({ parentId: t.id, name: "" })} className="hidden rounded p-0.5 text-muted-foreground hover:bg-accent group-hover:block"><Plus className="h-3 w-3" /></button>}
            </div>
          ))}
        </div>
      </div>
      {adding && (
        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="absolute bottom-3 left-3 right-3 z-10 flex gap-2 rounded-xl border border-border bg-popover p-2 shadow-lg sm:left-auto sm:w-96">
          <input autoFocus value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setAdding(null)} placeholder={adding.parentId ? "Subtask name" : "Task name"} aria-label="Name" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px] outline-none focus:border-primary/50" />
          <button type="submit" className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground">Add</button>
        </form>
      )}
      {!tasks.length && <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-[13px] text-muted-foreground">No tasks yet. Use + on the list to add one.</p>}
    </section>
  );
}

// ───────────────────────── Collection (files) ─────────────────────────

type ListFile = { id: number; createdAt: string; uploadedBy: WorkUser; file: { id: number; fileName: string; mimeType: string; fileSize: number; url: string }; task: { uid: string; name: string } };

/** Collection view: every file attached to the list's tasks */
export function CollectionView({ listUid, onOpenTask }: { listUid: string; onOpenTask: (uid: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["work", "list-files", listUid], queryFn: async () => (await api.get<ListFile[]>(`/work/lists/${listUid}/files`)).data });
  const [kind, setKind] = useState<"all" | "image" | "video" | "doc">("all");
  if (isLoading) return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div>;
  const typeOf = (m: string) => (m.startsWith("image/") ? "image" : m.startsWith("video/") ? "video" : "doc");
  const rows = (data ?? []).filter((f) => kind === "all" || typeOf(f.file.mimeType) === kind);
  return (
    <section aria-label="Files">
      <div role="tablist" aria-label="File type" className="mb-3 flex gap-1">
        {(["all", "image", "video", "doc"] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("rounded-md px-2.5 py-1 text-[12.5px] font-medium", kind === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}>{k === "all" ? "All files" : k === "image" ? "Images" : k === "video" ? "Videos" : "Documents"}</button>
        ))}
      </div>
      {!rows.length ? (
        <p className="py-16 text-center text-[13px] text-muted-foreground">No files in this list yet. Files attached to tasks show up here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {rows.map((f) => (
            <li key={f.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <a href={f.file.url} target="_blank" rel="noreferrer noopener" className="flex h-32 items-center justify-center bg-muted/40">
                {typeOf(f.file.mimeType) === "image" ? <img src={f.file.url} alt={f.file.fileName} className="h-full w-full object-cover" /> : typeOf(f.file.mimeType) === "video" ? <video src={f.file.url} className="h-full w-full object-cover" muted /> : <FileText className="h-10 w-10 text-muted-foreground/60" />}
              </a>
              <div className="p-2.5">
                <p className="truncate text-[12.5px] font-medium" title={f.file.fileName}>{f.file.fileName}</p>
                <button type="button" onClick={() => onOpenTask(f.task.uid)} className="block max-w-full truncate text-left text-[11.5px] text-muted-foreground hover:text-primary">{f.task.name}</button>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="flex-1 truncate">{userName(f.uploadedBy)} · {ago(f.createdAt)}</span>
                  <a href={f.file.url} download={f.file.fileName} aria-label={`Download ${f.file.fileName}`} className="rounded p-0.5 hover:bg-accent"><Download className="h-3 w-3" /></a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────── Map ─────────────────────────

type Loc = { address: string; lat: number; lng: number };

/** Map view: tasks placed by their Location field (OpenStreetMap) */
export function MapView({ list, tasks, fields, fieldValues, canEdit, onFieldChange, onOpenTask }: { list: WorkListDetail; tasks: WorkTask[]; fields: WorkField[]; fieldValues: FieldValues; canEdit: boolean; onFieldChange: (taskId: number, fieldId: number, value: unknown) => void; onOpenTask: (uid: string) => void }) {
  const qc = useQueryClient();
  const locFields = fields.filter((f) => f.type === "location");
  const [fieldId, setFieldId] = useState<number | null>(null);
  const field = locFields.find((f) => f.id === fieldId) ?? locFields[0];
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const placed = useMemo(() => (field ? tasks.map((t) => ({ t, loc: fieldValues[t.id]?.[field.id] as Loc | undefined })).filter((x): x is { t: WorkTask; loc: Loc } => !!x.loc && Number.isFinite(x.loc.lat)) : []), [tasks, fieldValues, field]);
  const missing = field ? tasks.filter((t) => !fieldValues[t.id]?.[field.id]) : [];

  useEffect(() => {
    if (!field || !el.current) return;
    let alive = true;
    void import("leaflet").then((L) => {
      if (!alive || !el.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(el.current, { zoomControl: true }).setView([20, 0], 2);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }
      layerRef.current.clearLayers();
      const pts: [number, number][] = [];
      for (const { t, loc } of placed) {
        const st = list.statuses.find((s) => s.id === t.statusId);
        const icon = L.divIcon({ className: "", html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${st?.color ?? "#2563EB"};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        const m = L.marker([loc.lat, loc.lng], { icon, title: t.name }).addTo(layerRef.current);
        const div = document.createElement("div");
        const b = document.createElement("button");
        b.textContent = t.name; b.style.fontWeight = "600"; b.style.textAlign = "left"; b.onclick = () => onOpenTask(t.uid);
        const p = document.createElement("div"); p.textContent = loc.address; p.style.fontSize = "11px"; p.style.opacity = "0.7"; p.style.marginTop = "2px";
        div.append(b, p);
        m.bindPopup(div);
        pts.push([loc.lat, loc.lng]);
      }
      if (pts.length === 1) mapRef.current.setView(pts[0], 13);
      else if (pts.length > 1) mapRef.current.fitBounds(pts, { padding: [40, 40] });
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    });
    return () => { alive = false; };
  }, [field, placed, list.statuses, onOpenTask]);
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  if (!field) {
    const create = async () => {
      try {
        await workApi.createField(list.spaceId, { name: "Location", type: "location" });
        await qc.invalidateQueries({ queryKey: fieldsKey(list.spaceId) });
      } catch (e) { toast.error(errMsg(e, "Couldn't add the field.")); }
    };
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <MapPin className="mx-auto h-10 w-10 text-[#EA580C]" />
        <h2 className="mt-3 text-[18px] font-semibold">Put tasks on a map</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">The Map view places tasks by a Location field. Add one, then set an address on each task.</p>
        {list.access.canManage ? <button type="button" onClick={create} className="mt-4 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground">Add a Location field</button> : <p className="mt-3 text-[12.5px] text-muted-foreground">Ask an admin to add a Location field to this space.</p>}
      </div>
    );
  }
  return (
    <section aria-label="Map" className="grid gap-3 lg:grid-cols-[1fr_300px]">
      <div className="relative z-0 overflow-hidden rounded-xl border border-border">
        <div ref={el} className="h-[calc(100vh-280px)] min-h-[420px] w-full" />
      </div>
      <aside className="max-h-[calc(100vh-280px)] min-h-[420px] overflow-y-auto rounded-xl border border-border bg-card p-3">
        {locFields.length > 1 && (
          <select aria-label="Location field" value={field.id} onChange={(e) => setFieldId(Number(e.target.value))} className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px]">
            {locFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        <p className="text-[12px] font-medium text-muted-foreground">{placed.length} on the map</p>
        {missing.length > 0 && (
          <>
            <p className="mt-3 text-[12px] font-medium text-muted-foreground">No location yet ({missing.length})</p>
            <ul className="mt-1 space-y-1">
              {missing.slice(0, 100).map((t) => (
                <li key={t.id} className="rounded-lg border border-border/70 px-2 py-1.5">
                  <button type="button" onClick={() => onOpenTask(t.uid)} className="block max-w-full truncate text-left text-[12.5px] font-medium hover:text-primary">{t.name}</button>
                  <FieldEditor field={field} value={undefined} disabled={!canEdit} onChange={(v) => onFieldChange(t.id, field.id, v)} compact />
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </section>
  );
}

// ───────────────────────── Embeds ─────────────────────────

export type EmbedKind = "web" | "sheets" | "gdocs" | "gcal" | "youtube" | "figma";
export type EmbedView = { id: string; kind: EmbedKind; name: string; url: string };

/** turn a pasted link into one that can be shown in a frame */
export function embedUrl(kind: EmbedKind, raw: string): string | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (kind === "youtube") {
    const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null);
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (kind === "figma") return host.endsWith("figma.com") ? `https://www.figma.com/embed?embed_host=ezmanage&url=${encodeURIComponent(u.toString())}` : null;
  if (kind === "sheets" || kind === "gdocs") {
    if (host !== "docs.google.com") return null;
    return u.toString().replace(/\/(edit|view)([?#].*)?$/, "/preview");
  }
  if (kind === "gcal") return host === "calendar.google.com" ? u.toString() : null;
  return u.toString();
}

export function EmbedFrame({ view }: { view: EmbedView }) {
  return (
    <section aria-label={view.name} className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px]">
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{view.url}</span>
        <a href={view.url.replace("https://www.youtube.com/embed/", "https://www.youtube.com/watch?v=")} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
      </div>
      <iframe title={view.name} src={view.url} className="h-[calc(100vh-280px)] min-h-[480px] w-full bg-white" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture" referrerPolicy="no-referrer-when-downgrade" />
      <p className="px-3 py-1.5 text-[11px] text-muted-foreground">Blank? Some sites don&apos;t allow being shown inside other apps — use Open.</p>
    </section>
  );
}
