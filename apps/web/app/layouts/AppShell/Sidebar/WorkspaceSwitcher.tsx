"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Plus,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Workspace } from "@repo/shared";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { cn } from "@/lib/utils";

/* ── localStorage helpers ─────────────────────────────── */
const RECENT_KEY = "ez_recent_workspace_ids";

function getRecentIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecentId(id: number) {
  try {
    const ids = getRecentIds().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 3)));
  } catch {}
}

/* ── Avatar ───────────────────────────────────────────── */
const AVATAR_COLORS = [
  "bg-pink-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-amber-500",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function WorkspaceAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initial = name?.charAt(0)?.toUpperCase() ?? "W";
  const color = avatarColor(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-bold text-white",
        color,
        size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs",
      )}
    >
      {initial}
    </span>
  );
}

/* ── Row ─────────────────────────────────────────────── */
function WorkspaceRow({
  workspace,
  active,
  onClick,
}: {
  workspace: Workspace;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-accent",
      )}
    >
      <WorkspaceAvatar name={workspace.name} />
      <span className="flex-1 truncate text-left">{workspace.name}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  );
}

/* ── Section label ───────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
      {children}
    </p>
  );
}

/* ── Main component ──────────────────────────────────── */
interface WorkspaceSwitcherProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  workspaces: Workspace[];
  workspace?: Workspace | null;
  onWorkspaceChange?: (workspace: Workspace) => void;
  getWorkspaceBoard?: (workspace: Workspace) => Promise<{ id: number } | null>;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
}

export function WorkspaceSwitcher({
  open,
  setOpen,
  workspaces,
  workspace,
  onWorkspaceChange,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [localOpen, setLocalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const controlled = open !== undefined;
  const isOpen = controlled ? open! : localOpen;
  const setIsOpen = controlled ? setOpen! : setLocalOpen;

  /* Calculate fixed position from trigger rect */
  const calcPos = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 240),
    });
  };

  /* load recent ids + calc position when panel opens */
  useEffect(() => {
    if (isOpen) {
      setRecentIds(getRecentIds());
      calcPos();
    }
  }, [isOpen]);

  /* reposition on scroll/resize */
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => calcPos();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [isOpen]);

  /* close on outside click */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
      setSearch("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = async (selected: Workspace) => {
    pushRecentId(selected.id);
    onWorkspaceChange?.(selected);
    setIsOpen(false);
    setSearch("");
    router.push(`/workspace/${selected.id}`);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? workspaces.filter((w) => w.name.toLowerCase().includes(q))
    : workspaces;

  const recentWorkspaces = recentIds
    .map((id) => workspaces.find((w) => w.id === id))
    .filter((w): w is Workspace => !!w);

  return (
    <div className="flex-1 min-w-0">
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="flex h-9 w-full items-center gap-2 overflow-hidden rounded-md border bg-background px-2.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent focus-visible:outline-none"
      >
        {workspace ? (
          <WorkspaceAvatar name={workspace.name} size="sm" />
        ) : (
          <span className="inline-flex h-5 w-5 shrink-0 rounded bg-muted" />
        )}
        <span className="flex-1 truncate text-left">
          {workspace?.name ?? "Select workspace"}
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* ── Panel — portaled to body so transform ancestors don't trap it ── */}
      {isOpen && panelPos && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
          }}
          className="z-[200] overflow-hidden rounded-xl border bg-background shadow-2xl"
        >
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a workspace"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto px-2 pb-2">
            {/* Recent — only when no search */}
            {!q && recentWorkspaces.length > 0 && (
              <>
                <SectionLabel>Recent workspaces</SectionLabel>
                {recentWorkspaces.map((w) => (
                  <WorkspaceRow
                    key={`recent-${w.id}`}
                    workspace={w}
                    active={workspace?.id === w.id}
                    onClick={() => handleSelect(w)}
                  />
                ))}
                <div className="my-1 border-t" />
              </>
            )}

            {/* All / filtered */}
            <SectionLabel>{q ? "Results" : "My workspaces"}</SectionLabel>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No workspaces found
              </p>
            ) : (
              filtered.map((w) => (
                <WorkspaceRow
                  key={w.id}
                  workspace={w}
                  active={workspace?.id === w.id}
                  onClick={() => handleSelect(w)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
              Browse all
            </button>
            <div className="border-t" />
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add workspace
            </button>
          </div>
        </div>,
        document.body,
      )}

      <CreateWorkspaceModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
