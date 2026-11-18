"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowUpRight, Circle, Hand, MousePointer2, PenTool, Plus, Square, StickyNote, Trash2, Type, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "@/lib/api";
import { workApi, workKeys } from "@/services/work.api";
import { cn } from "@/lib/utils";
import type { WorkUser } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";
import { LiveRoom, PeersBar, colorFor, usePeers, type CollabUser } from "../../_components/collab";

type Shape = { id: string; type: "note" | "rect" | "ellipse" | "text" | "arrow" | "pen"; x: number; y: number; w: number; h: number; color: string; text?: string; points?: [number, number][]; z?: number };
type Row = { id: number; uid: string; title: string; updatedAt: string; items: number; updatedBy: WorkUser | null };
type Board = { id: number; uid: string; title: string; data: { shapes: Shape[] }; canEdit: boolean };
type Tool = "select" | "pan" | Shape["type"];
const COLORS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fecaca", "#1f2937"];
const newId = () => Math.random().toString(36).slice(2, 10);

/** Work → Whiteboards: notes, shapes, text, arrows and pen drawing; autosaves. */
export default function WhiteboardsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { data: accessTree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws, staleTime: 30_000 });
  const canCreate = !!accessTree?.access.canEdit;
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const current = sp.get("board");
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["work", "whiteboards", ws], queryFn: async () => (await api.get<Row[]>(`/work/workspaces/${ws}/whiteboards`)).data, enabled: !current });
  const create = useMutation({
    mutationFn: async () => (await api.post<{ uid: string }>(`/work/workspaces/${ws}/whiteboards`, { title: "Untitled whiteboard" })).data,
    onSuccess: (b) => { qc.invalidateQueries({ queryKey: ["work", "whiteboards", ws] }); router.push(`/work/${ws}/whiteboards?board=${b.uid}`); },
    onError: () => toast.error("Couldn't create the whiteboard."),
  });
  if (current) return <Canvas key={current} uid={current} onBack={() => router.push(`/work/${ws}/whiteboards`)} />;
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6">
      <PageHeader icon={PenTool} title="Whiteboards" subtitle="Brainstorm with sticky notes, shapes, arrows and drawing." color="#d97706" actions={<>
        {canCreate && <button type="button" onClick={() => create.mutate()} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New whiteboard</button>}
      </>} />
      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : !rows.length ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-muted-foreground">No whiteboards yet.</p>
      ) : (
        <ul aria-label="Whiteboards" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}><button type="button" onClick={() => router.push(`/work/${ws}/whiteboards?board=${r.uid}`)} className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40">
              <span className="block h-20 rounded-lg bg-[radial-gradient(circle,_rgba(148,163,184,.35)_1px,_transparent_1px)] [background-size:14px_14px]" />
              <span className="mt-2 block truncate text-[14px] font-semibold">{r.title}</span>
              <span className="text-[11.5px] text-muted-foreground">{r.items} {r.items === 1 ? "item" : "items"} · {new Date(r.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}{r.updatedBy ? ` · ${r.updatedBy.firstName}` : ""}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Canvas({ uid, onBack }: { uid: string; onBack: () => void }) {
  const { data: board, refetch } = useQuery({ queryKey: ["work", "whiteboard", uid], queryFn: async () => (await api.get<Board>(`/work/whiteboards/${uid}`)).data, refetchOnWindowFocus: false });
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [title, setTitle] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]!);
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [state, setState] = useState<"saved" | "saving" | "unsaved">("saved");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "move" | "resize" | "draw" | "pan"; id?: string; sx: number; sy: number; orig?: Shape; vx?: number; vy?: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);
  const canEdit = !!board?.canEdit;
  const { user } = useAuth();
  const me = useMemo<CollabUser | null>(() => (user?.id ? { id: user.id, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Someone", color: colorFor(user.id), avatarUrl: user.avatarUrl ?? null } : null), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // live co-editing: shapes live in a shared map (one entry per shape), so two people drawing at once both keep their work
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [gen, setGen] = useState(0);
  const roomRef = useRef<LiveRoom | null>(null);
  const derive = (r: LiveRoom) => [...r.ydoc.getMap<Shape>("shapes").values()].sort((a, b) => (a.z ?? 0) - (b.z ?? 0) || a.id.localeCompare(b.id));
  useEffect(() => {
    if (!board?.id || !me) return;
    const r = new LiveRoom("whiteboards", uid, me);
    let off = false;
    r.onReset = () => { loaded.current = false; void refetch().then(() => setGen((g) => g + 1)); };
    r.start().then((j) => {
      if (off) return;
      if (!j.live) return;
      roomRef.current = r; setRoom(r);
      loaded.current = true;
      setShapes(derive(r));
      const t = r.ydoc.getMap<string>("meta").get("title");
      if (typeof t === "string") setTitle(t);
    }).catch(() => null);
    const shapesMap = r.ydoc.getMap<Shape>("shapes");
    const onShapes = (e: { transaction: { local: boolean } }) => {
      if (e.transaction.local || roomRef.current !== r) return;
      const live = derive(r);
      setShapes((cur) => {
        // keep what this person is dragging / drawing right now
        const d = drag.current;
        const mine = d?.id ? cur.find((x) => x.id === d.id) : undefined;
        return mine ? [...live.filter((x) => x.id !== mine.id), mine] : live;
      });
    };
    const meta = r.ydoc.getMap<string>("meta");
    const onMeta = (e: { transaction: { local: boolean } }) => { const v = meta.get("title"); if (!e.transaction.local && typeof v === "string") setTitle(v); };
    shapesMap.observe(onShapes); meta.observe(onMeta);
    return () => { off = true; shapesMap.unobserve(onShapes); meta.unobserve(onMeta); if (roomRef.current === r) roomRef.current = null; setRoom(null); void r.destroy(); };
  }, [board?.id, me, uid, gen]); // eslint-disable-line react-hooks/exhaustive-deps
  const peers = usePeers(room);
  /** write the local picture into the shared map: only the shapes that changed */
  const syncY = (next: Shape[]) => {
    const r = roomRef.current; if (!r || !canEdit) return;
    const m = r.ydoc.getMap<Shape>("shapes");
    r.ydoc.transact(() => {
      let top = Math.max(0, ...[...m.values()].map((x) => x.z ?? 0));
      const keep = new Set<string>();
      for (const sh of next) {
        keep.add(sh.id);
        const old = m.get(sh.id);
        const want = { ...sh, z: old?.z ?? sh.z ?? ++top };
        if (!old || JSON.stringify(old) !== JSON.stringify(want)) m.set(sh.id, want);
      }
      for (const k of [...m.keys()]) if (!keep.has(k)) m.delete(k);
    });
  };
  const lastPointer = useRef(0);
  const sharePointer = (e: React.PointerEvent) => {
    const r = roomRef.current; if (!r || !svg.current) return;
    const now = Date.now(); if (now - lastPointer.current < 80) return;
    lastPointer.current = now;
    const p = pt(e);
    r.awareness.setLocalStateField("pointer", { x: Math.round(p.x), y: Math.round(p.y) });
  };

  useEffect(() => { if (board && !loaded.current && !roomRef.current) { loaded.current = true; setShapes(board.data?.shapes ?? []); setTitle(board.title); } }, [board]);
  // changes wait 0.7 s and are sent together (a title edit and a drawing in the same moment both save)
  const pending = useRef<{ shapes?: Shape[]; title?: string }>({});
  const save = (next: { shapes?: Shape[]; title?: string }) => {
    if (!canEdit) return;
    pending.current = { ...pending.current, ...next };
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const p = pending.current; pending.current = {};
      setState("saving");
      try { await api.patch(`/work/whiteboards/${uid}`, { ...(p.shapes ? { data: { shapes: p.shapes } } : {}), ...(p.title !== undefined ? { title: p.title } : {}), ...(roomRef.current ? { live: true } : {}) }); setState("saved"); }
      catch { pending.current = { ...p, ...pending.current }; setState("unsaved"); toast.error("Couldn't save the whiteboard."); }
    }, 700);
  };
  const commit = (next: Shape[]) => { setShapes(next); syncY(next); save({ shapes: next }); };
  const pt = (e: React.PointerEvent | PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z }; };

  const onDown = (e: React.PointerEvent, shape?: Shape, handle?: boolean) => {
    if (editing) return;
    const p = pt(e);
    if (tool === "pan" || e.button === 1) { drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
    if (!canEdit) return;
    if (tool === "select") {
      if (shape) { e.stopPropagation(); setSel(shape.id); drag.current = { kind: handle ? "resize" : "move", id: shape.id, sx: p.x, sy: p.y, orig: { ...shape } }; }
      else { setSel(null); drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; }
      return;
    }
    const s: Shape = tool === "pen" ? { id: newId(), type: "pen", x: 0, y: 0, w: 0, h: 0, color: color === COLORS[0] ? "#1f2937" : color, points: [[p.x, p.y]] }
      : tool === "arrow" ? { id: newId(), type: "arrow", x: p.x, y: p.y, w: 0, h: 0, color: color === COLORS[0] ? "#1f2937" : color }
      : tool === "note" ? { id: newId(), type: "note", x: p.x - 80, y: p.y - 60, w: 160, h: 120, color, text: "" }
      : tool === "text" ? { id: newId(), type: "text", x: p.x, y: p.y - 14, w: 220, h: 32, color: "#1f2937", text: "Text" }
      : { id: newId(), type: tool, x: p.x, y: p.y, w: 0, h: 0, color };
    setShapes((all) => [...all, s]);
    setSel(s.id);
    // new note / text: keep this click from stealing focus, then open its text box once the click is over
    if (tool === "note" || tool === "text") { e.preventDefault(); commit([...shapes, s]); setTool("select"); setTimeout(() => setEditing(s.id), 0); return; }
    drag.current = { kind: "draw", id: s.id, sx: p.x, sy: p.y };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    if (d.kind === "pan") { setView((v) => ({ ...v, x: d.vx! + e.clientX - d.sx, y: d.vy! + e.clientY - d.sy })); return; }
    const p = pt(e);
    setShapes((all) => all.map((s) => {
      if (s.id !== d.id) return s;
      if (d.kind === "move") return { ...s, x: d.orig!.x + p.x - d.sx, y: d.orig!.y + p.y - d.sy, points: d.orig!.points?.map(([x, y]) => [x + p.x - d.sx, y + p.y - d.sy] as [number, number]) };
      if (d.kind === "resize") return { ...s, w: Math.max(40, d.orig!.w + p.x - d.sx), h: Math.max(30, d.orig!.h + p.y - d.sy) };
      if (s.type === "pen") return { ...s, points: [...(s.points ?? []), [p.x, p.y] as [number, number]] };
      if (s.type === "arrow") return { ...s, w: p.x - s.x, h: p.y - s.y };
      return { ...s, x: Math.min(d.sx, p.x), y: Math.min(d.sy, p.y), w: Math.abs(p.x - d.sx), h: Math.abs(p.y - d.sy) };
    }));
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (!d || d.kind === "pan") return;
    setShapes((all) => {
      const next = all.filter((s) => !(s.id === d.id && d.kind === "draw" && (s.type === "rect" || s.type === "ellipse") && s.w < 4 && s.h < 4));
      syncY(next);
      save({ shapes: next });
      return next;
    });
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!sel || editing || !canEdit) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { commit(shapes.filter((s) => s.id !== sel)); setSel(null); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = (f: number) => setView((v) => ({ ...v, z: Math.min(3, Math.max(0.25, v.z * f)) }));
  const selected = shapes.find((s) => s.id === sel);

  const T = ({ id, icon: I, label }: { id: Tool; icon: typeof Hand; label: string }) => <button type="button" aria-label={label} title={label} aria-pressed={tool === id} onClick={() => setTool(id)} disabled={!canEdit && id !== "pan" && id !== "select"} className={cn("rounded-md p-2 disabled:opacity-40", tool === id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}><I className="h-4 w-4" /></button>;

  if (!board) return <div className="m-6 h-[70vh] animate-pulse rounded-xl bg-muted" />;
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <button type="button" onClick={onBack} aria-label="All whiteboards" className="rounded-md p-1.5 hover:bg-accent"><ArrowLeft className="h-4 w-4" /></button>
        <input aria-label="Whiteboard title" value={title} readOnly={!canEdit} onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value }); roomRef.current?.ydoc.getMap<string>("meta").set("title", e.target.value); }} className="min-w-[200px] flex-1 bg-transparent text-[16px] font-semibold outline-none" />
        <PeersBar peers={peers} meId={me?.id} />
        <span className="text-[11.5px] text-muted-foreground">{state === "saving" ? "Saving…" : state === "unsaved" ? "Unsaved" : "Saved"}</span>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle,_rgba(148,163,184,.35)_1px,_transparent_1px)]" style={{ backgroundSize: `${16 * view.z}px ${16 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
        <div role="toolbar" aria-label="Whiteboard tools" className="absolute left-3 top-3 z-10 flex flex-col gap-0.5 rounded-xl border border-border bg-card p-1 shadow-md">
          <T id="select" icon={MousePointer2} label="Select and move" />
          <T id="pan" icon={Hand} label="Pan" />
          <T id="note" icon={StickyNote} label="Sticky note" />
          <T id="rect" icon={Square} label="Rectangle" />
          <T id="ellipse" icon={Circle} label="Ellipse" />
          <T id="text" icon={Type} label="Text" />
          <T id="arrow" icon={ArrowUpRight} label="Arrow" />
          <T id="pen" icon={PenTool} label="Pen" />
        </div>
        {canEdit && (
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-md">
            {COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={(selected?.color ?? color) === c} onClick={() => { setColor(c); if (selected) commit(shapes.map((s) => (s.id === selected.id ? { ...s, color: c } : s))); }} className={cn("h-6 w-6 rounded-full border border-black/10", (selected?.color ?? color) === c && "ring-2 ring-primary ring-offset-1")} style={{ background: c }} />)}
            {selected && <button type="button" aria-label="Delete selected" onClick={() => { commit(shapes.filter((s) => s.id !== selected.id)); setSel(null); }} className="ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-md text-[12px]">
          <button type="button" aria-label="Zoom out" onClick={() => zoom(0.8)} className="rounded-md p-1.5 hover:bg-accent"><ZoomOut className="h-4 w-4" /></button>
          <button type="button" onClick={() => setView({ x: 0, y: 0, z: 1 })} className="w-12 rounded-md py-1 font-mono hover:bg-accent">{Math.round(view.z * 100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.25)} className="rounded-md p-1.5 hover:bg-accent"><ZoomIn className="h-4 w-4" /></button>
        </div>
        <svg ref={svg} role="application" aria-label="Whiteboard canvas" className={cn("h-full w-full touch-none", tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
          onPointerDown={(e) => onDown(e)} onPointerMove={(e) => { sharePointer(e); onMove(e); }} onPointerUp={onUp} onPointerLeave={onUp}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) zoom(e.deltaY < 0 ? 1.1 : 0.9); else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })); }}>
          <defs><marker id="wb-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke" /></marker></defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.z})`}>
            {shapes.map((s) => {
              const on = s.id === sel;
              const down = (e: React.PointerEvent) => onDown(e, s);
              const ring = on ? { stroke: "#047857", strokeWidth: 2 / view.z, strokeDasharray: `${4 / view.z} ${3 / view.z}` } : {};
              if (s.type === "pen") return <polyline key={s.id} points={(s.points ?? []).map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" onPointerDown={down} style={{ cursor: "move" }} opacity={on ? 0.7 : 1} />;
              if (s.type === "arrow") return <line key={s.id} x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} stroke={s.color} strokeWidth={on ? 4 : 2.5} markerEnd="url(#wb-arrow)" onPointerDown={down} style={{ cursor: "move" }} />;
              const body = s.type === "ellipse" ? <ellipse cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} fill={s.color} fillOpacity={0.85} stroke="#0f172a22" {...ring} />
                : s.type === "text" ? <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="transparent" {...ring} />
                : <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.type === "note" ? 6 : 4} fill={s.color} stroke="#0f172a22" style={s.type === "note" ? { filter: "drop-shadow(0 2px 3px rgba(0,0,0,.12))" } : undefined} {...ring} />;
              return (
                <g key={s.id} onPointerDown={down} onDoubleClick={() => canEdit && (s.type === "note" || s.type === "text" || s.type === "rect" || s.type === "ellipse") && setEditing(s.id)} style={{ cursor: canEdit ? "move" : "default" }}>
                  {body}
                  <foreignObject x={s.x + 6} y={s.y + 6} width={Math.max(10, s.w - 12)} height={Math.max(10, s.h - 12)}>
                    {editing === s.id ? (
                      <textarea autoFocus aria-label="Edit text" defaultValue={s.text ?? ""} onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) => { const v = e.target.value; setEditing(null); commit(shapes.map((x) => (x.id === s.id ? { ...x, text: v } : x))); }}
                        className="h-full w-full resize-none bg-transparent text-[14px] leading-snug text-[#1f2937] outline-none" style={{ fontSize: s.type === "text" ? 18 : 14 }} />
                    ) : (
                      <div className="h-full w-full overflow-hidden whitespace-pre-wrap break-words leading-snug" style={{ fontSize: s.type === "text" ? 18 : 14, color: s.color === "#1f2937" && s.type !== "text" ? "#fff" : "#1f2937" }}>{s.text}</div>
                    )}
                  </foreignObject>
                  {on && canEdit && <rect x={s.x + s.w - 6 / view.z} y={s.y + s.h - 6 / view.z} width={12 / view.z} height={12 / view.z} fill="#047857" style={{ cursor: "nwse-resize" }} onPointerDown={(e) => onDown(e, s, true)} aria-label="Resize" />}
                </g>
              );
            })}
            {peers.filter((p) => p.pointer && p.id !== me?.id).map((p) => (
              <g key={`ptr-${p.id}`} transform={`translate(${p.pointer!.x},${p.pointer!.y}) scale(${1 / view.z})`} pointerEvents="none" aria-hidden>
                <path d="M0,0 L0,16 L4.5,12 L8,19 L10.5,18 L7,11 L13,11 z" fill={p.color} stroke="#fff" strokeWidth={1.2} />
                <rect x={12} y={16} rx={4} width={p.name.length * 6.6 + 10} height={18} fill={p.color} />
                <text x={17} y={29} fontSize={11} fontWeight={600} fill="#fff">{p.name}</text>
              </g>
            ))}
          </g>
        </svg>
        {!shapes.length && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">{canEdit ? "Pick a tool on the left — a sticky note is a good start. Double-click a note to type." : "This whiteboard is empty."}</p>}
      </div>
    </div>
  );
}
