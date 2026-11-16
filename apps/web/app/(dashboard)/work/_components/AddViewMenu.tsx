"use client";

import { useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Columns3,
  FileText,
  Shapes,
  FolderOpen,
  GanttChart,
  Globe,
  GitFork,
  LayoutGrid,
  List as ListIcon,
  Map,
  PenTool,
  Plus,
  Search,
  Sheet,
  SquareCheckBig,
  Table2,
  Users,
  PlaySquare,
  CalendarRange,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { embedUrl, type EmbedKind } from "./MoreViews";

export type WorkView = "list" | "board" | "calendar" | "table" | "gallery" | "dashboard" | "gantt" | "timeline" | "workload" | "activity" | "mindmap" | "team" | "map" | "collection";
export type WorkModule = "doc" | "form" | "whiteboard";

type Item = { id: string; label: string; hint: string; icon: typeof ListIcon; color: string; ready?: WorkView; module?: WorkModule; embed?: EmbedKind };
const POPULAR: Item[] = [
  { id: "list", label: "List", hint: "Track tasks, bugs, people & more", icon: ListIcon, color: "#475569", ready: "list" },
  { id: "gantt", label: "Gantt", hint: "Plan dependencies & time", icon: GanttChart, color: "#DC2626", ready: "gantt" },
  { id: "calendar", label: "Calendar", hint: "Plan, schedule & delegate", icon: CalendarDays, color: "#EA580C", ready: "calendar" },
  { id: "doc", label: "Doc", hint: "Collaborate & document anything", icon: FileText, color: "#2563EB", module: "doc" },
  { id: "board", label: "Board – Kanban", hint: "Move tasks between columns", icon: Columns3, color: "#2563EB", ready: "board" },
  { id: "form", label: "Form", hint: "Collect, track & report data", icon: SquareCheckBig, color: "#7C3AED", module: "form" },
  { id: "dashboard", label: "Dashboard", hint: "Track metrics & insights", icon: BarChart3, color: "#9333EA", ready: "dashboard" },
  { id: "gallery", label: "Gallery", hint: "Gallery of tasks", icon: LayoutGrid, color: "#7C3AED", ready: "gallery" },
];
const MORE: Item[] = [
  { id: "table", label: "Table", hint: "Structured table format", icon: Table2, color: "#16A34A", ready: "table" },
  { id: "whiteboard", label: "Whiteboard", hint: "Visualize & brainstorm ideas", icon: PenTool, color: "#CA8A04", module: "whiteboard" },
  { id: "timeline", label: "Timeline", hint: "See tasks by start & due date", icon: CalendarRange, color: "#EA580C", ready: "timeline" },
  { id: "activity", label: "Activity", hint: "Real-time activity feed", icon: Activity, color: "#0284C7", ready: "activity" },
  { id: "workload", label: "Workload", hint: "Visualize team capacity", icon: BarChart3, color: "#0D9488", ready: "workload" },
  { id: "mindmap", label: "Mind Map", hint: "Visual brainstorming of ideas", icon: GitFork, color: "#DB2777", ready: "mindmap" },
  { id: "team", label: "Team", hint: "Monitor work being done", icon: Users, color: "#9333EA", ready: "team" },
  { id: "map", label: "Map", hint: "Tasks visualized by address", icon: Map, color: "#EA580C", ready: "map" },
  { id: "collection", label: "Collection", hint: "Files and collections in one place", icon: FolderOpen, color: "#EA580C", ready: "collection" },
];
const EMBEDS: Item[] = [
  { id: "web", label: "Any website", hint: "Embed any web content", icon: Globe, color: "#475569", embed: "web" },
  { id: "sheets", label: "Google Sheets", hint: "Sync your spreadsheets", icon: Sheet, color: "#16A34A", embed: "sheets" },
  { id: "gdocs", label: "Google Docs", hint: "Sync your documents", icon: FileText, color: "#2563EB", embed: "gdocs" },
  { id: "gcal", label: "Google Calendar", hint: "Sync Google Calendar events", icon: CalendarDays, color: "#2563EB", embed: "gcal" },
  { id: "youtube", label: "YouTube", hint: "Share your favorite videos", icon: PlaySquare, color: "#DC2626", embed: "youtube" },
  { id: "figma", label: "Figma", hint: "View your designs", icon: Shapes, color: "#A855F7", embed: "figma" },
];

/** ClickUp-style "+ View" catalog. Ready views are added to the list's tabs. */
export function AddViewMenu({ onAdd, onModule, onEmbed }: { onAdd: (v: WorkView) => void; onModule?: (m: WorkModule) => void; onEmbed?: (e: { kind: EmbedKind; name: string; url: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [embedFor, setEmbedFor] = useState<Item | null>(null);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const close = () => { setOpen(false); setQ(""); setEmbedFor(null); setLink(""); setErr(""); };
  const pick = (i: Item) => {
    if (i.ready) { onAdd(i.ready); close(); }
    else if (i.module && onModule) { onModule(i.module); close(); }
    else if (i.embed && onEmbed) { setEmbedFor(i); setLink(""); setErr(""); }
  };
  const usable = (i: Item) => !!i.ready || (!!i.module && !!onModule) || (!!i.embed && !!onEmbed);
  const term = q.trim().toLowerCase();
  const match = (i: Item) => !term || `${i.label} ${i.hint}`.toLowerCase().includes(term);
  const Section = ({ title, items }: { title: string; items: Item[] }) => {
    const shown = items.filter(match);
    if (!shown.length) return null;
    return (
      <div className="border-b border-border/70 px-2 pb-2 pt-2 last:border-b-0">
        <p className="px-2 pb-1 text-[12px] font-medium text-muted-foreground">{title}</p>
        <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {shown.map((i) => (
            <button
              key={i.id}
              type="button"
              disabled={!usable(i)}
              onClick={() => pick(i)}
              className={cn("flex items-center gap-3 rounded-lg px-2 py-2 text-left", usable(i) ? "hover:bg-accent" : "cursor-not-allowed opacity-55")}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: i.color }}><i.icon className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  {i.label}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">{i.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" /> View
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(560px,92vw)] p-0">
        {embedFor ? (
          <form
            className="space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const url = embedUrl(embedFor.embed!, link);
              if (!url) { setErr(`That doesn't look like a ${embedFor.label} link.`); return; }
              onEmbed!({ kind: embedFor.embed!, name: embedFor.id === "web" ? new URL(url).hostname.replace(/^www\./, "") : embedFor.label, url });
              close();
            }}
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-md text-white" style={{ background: embedFor.color }}><embedFor.icon className="h-4 w-4" /></span>Add {embedFor.label} view</p>
            <input autoFocus value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} placeholder={embedFor.embed === "youtube" ? "https://www.youtube.com/watch?v=…" : embedFor.embed === "figma" ? "https://www.figma.com/file/…" : embedFor.embed === "gcal" ? "Google Calendar embed link" : "https://…"} aria-label="Link" className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50" />
            {err && <p className="text-[12px] text-destructive">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEmbedFor(null)} className="h-8 rounded-md px-3 text-[12.5px] text-muted-foreground hover:bg-accent">Back</button>
              <button type="submit" className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground">Add view</button>
            </div>
          </form>
        ) : (<>
        <label className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search views…" aria-label="Search views" className="w-full bg-transparent text-[13.5px] outline-none" />
        </label>
        <div className="max-h-[60vh] overflow-y-auto">
          <Section title="Popular" items={POPULAR} />
          <Section title="More views" items={MORE} />
          <Section title="Embeds" items={EMBEDS} />
        </div>
        </>)}
      </PopoverContent>
    </Popover>
  );
}
