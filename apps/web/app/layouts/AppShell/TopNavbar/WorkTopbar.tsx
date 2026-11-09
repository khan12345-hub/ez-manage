"use client";

/*
 * Work's own header (ClickUp-style): workspace switcher · back/forward · search ·
 * attention chip · timer · quick create · inbox · profile. Nothing from Boards.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Check,
  ChevronDown,
  CircleAlert,
  Keyboard,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Search,
  Settings,
  SmilePlus,
  SquarePlus,
  Sun,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import { useAuth } from "@/providers/AuthProvider";
import { useLogout } from "@/services/auth/auth.hooks";
import { setUserStatus } from "@/services/chat.api";
import { isTaskOverdue, dayOf, workApi } from "@/services/work.api";
import { useCommandPalette } from "@/store/command-palette";
import { useWorkCreate } from "@/store/work-create";
import { RunningTimer } from "./RunningTimer";
import { WorkInboxBell } from "./WorkInboxBell";

export const MUTE_KEY = "ez:work:muteUntil";
export function isWorkMuted() {
  try {
    const v = Number(localStorage.getItem(MUTE_KEY) ?? 0);
    return v === -1 || v > Date.now();
  } catch {
    return false;
  }
}

const STATUS_EMOJIS = ["🟢", "📅", "🤒", "🌴", "🏠", "🎧", "☕", "🚗"];

export function WorkTopbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter();
  const params = useParams<{ workspaceId?: string }>();
  const ws = String(params.workspaceId ?? "");
  const { user } = useAuth();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const setPaletteOpen = useCommandPalette((s) => s.setPaletteOpen);
  const openCreate = useWorkCreate((s) => s.openCreate);
  const [statusOpen, setStatusOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(isWorkMuted()), []);

  const { data: workspaces = [] } = useQuery({ queryKey: ["work", "my-workspaces"], queryFn: workApi.myWorkspaces, staleTime: 30_000 });
  const current = workspaces.find((w) => w.uid === ws || String(w.id) === ws);
  const { data: tree } = useQuery({ queryKey: ["work", "tree", ws], queryFn: () => workApi.tree(ws), enabled: !!ws, staleTime: 30_000 });
  const { data: mine = [] } = useQuery({ queryKey: ["work", "my", ws], queryFn: () => workApi.myTasks(ws), enabled: !!ws, staleTime: 30_000 });
  const attention = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = mine.filter((t) => !t.completedAt && !t.parentId); // same count as My Tasks
    return {
      overdue: open.filter((t) => isTaskOverdue(t)).length,
      today: open.filter((t) => t.dueDate && dayOf(t.dueDate).getTime() === today.getTime()).length,
    };
  }, [mine]);

  const mute = (ms: number | -1 | 0) => {
    const until = ms === -1 ? -1 : ms === 0 ? 0 : Date.now() + ms;
    try { localStorage.setItem(MUTE_KEY, String(until)); } catch {}
    setMuted(until !== 0);
    toast.success(until === 0 ? "Notifications on" : "Notifications muted on this device");
  };
  const untilTomorrow = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(8, 0, 0, 0);
    return t.getTime() - Date.now();
  };
  const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  const avatar = resolveUrl(user?.avatarUrl);
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const statusEmoji = (user as any)?.chatStatusEmoji as string | undefined;
  const go = (href: string) => router.push(href);

  return (
    <>
      <header className="flex h-14 w-full shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-4">
        <button type="button" onClick={onMenuToggle} aria-label="Open menu" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden">
          <Menu className="h-5 w-5" />
        </button>

        {/* workspace switcher */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Switch workspace" className="flex min-w-0 max-w-[220px] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-product-work text-[12px] font-bold text-white">{(current?.name ?? "W")[0]?.toUpperCase()}</span>
              <span className="truncate text-[14px] font-semibold">{current?.name ?? "Work"}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1.5">
            <p className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Workspaces</p>
            {workspaces.map((w) => (
              <button key={w.id} type="button" onClick={() => go(`/work/${w.uid}`)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] hover:bg-accent">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-product-work/15 text-[11px] font-bold text-product-work">{w.name[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {w.uid === current?.uid && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            <button type="button" onClick={() => go(`/work/${ws}/people`)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Users className="h-4 w-4 text-muted-foreground" /> People</button>
            <button type="button" onClick={() => go(`/work/${ws}/notifications`)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"><Bell className="h-4 w-4 text-muted-foreground" /> Notification settings</button>
          </PopoverContent>
        </Popover>

        <span className="hidden items-center sm:flex">
          <button type="button" aria-label="Back" title="Back" onClick={() => router.back()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Forward" title="Forward" onClick={() => window.history.forward()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowRight className="h-4 w-4" /></button>
        </span>

        {/* search */}
        <div className="flex flex-1 justify-center px-1">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-9 w-full max-w-[520px] items-center gap-2 rounded-full border border-border bg-background px-3.5 text-[13.5px] text-muted-foreground hover:border-primary/30">
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate text-left">Search Work</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10.5px] sm:inline">Ctrl K</kbd>
          </button>
        </div>

        {/* attention: my overdue / due today */}
        {(attention.overdue > 0 || attention.today > 0) && (
          <Link
            href={ws ? `/work/${ws}` : "/work"}
            title="Your tasks that need attention"
            className={cn(
              "hidden h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold lg:flex",
              attention.overdue ? "bg-destructive/10 text-destructive hover:bg-destructive/15" : "bg-[#b08d57]/15 text-[#8a6a3a] hover:bg-[#b08d57]/25 dark:text-brass-soft",
            )}
          >
            <CircleAlert className="h-3.5 w-3.5" />
            {attention.overdue > 0 && <span>{attention.overdue} overdue</span>}
            {attention.overdue > 0 && attention.today > 0 && <span className="opacity-50">·</span>}
            {attention.today > 0 && <span>{attention.today} due today</span>}
          </Link>
        )}

        <RunningTimer />
        {tree?.access.canEdit && (
          <button type="button" aria-label="Create task" title="Create task" onClick={() => openCreate(null)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <SquarePlus className="h-[18px] w-[18px]" />
          </button>
        )}
        <WorkInboxBell />

        {/* profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Profile menu" className="relative ml-1 flex items-center gap-1 rounded-full p-0.5 hover:bg-muted">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[12px] font-semibold text-forest-foreground">{initials}</span>
              )}
              <span className={cn("absolute bottom-0 left-6 h-2.5 w-2.5 rounded-full ring-2 ring-card", muted ? "bg-muted-foreground" : "bg-emerald-500")} />
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <div className="flex items-center gap-2.5 px-2 py-2">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-[13px] font-semibold text-forest-foreground">{initials}</span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">{name || "You"}</span>
                <span className="block text-[12px] text-muted-foreground">{muted ? "Notifications muted" : "Online"}</span>
              </span>
            </div>
            <button type="button" onClick={() => setStatusOpen(true)} className="mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent">
              {statusEmoji ? <span>{statusEmoji}</span> : <SmilePlus className="h-4 w-4" />} {(user as any)?.chatStatusText || "Set status"}
            </button>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><BellOff className="mr-2 h-4 w-4 text-muted-foreground" />{muted ? "Notifications muted" : "Mute notifications"}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuItem onClick={() => mute(60 * 60_000)}>For 1 hour</DropdownMenuItem>
                <DropdownMenuItem onClick={() => mute(untilTomorrow())}>Until tomorrow</DropdownMenuItem>
                <DropdownMenuItem onClick={() => mute(-1)}>Until I turn it back on</DropdownMenuItem>
                {muted && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => mute(0)}>Turn notifications on</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => go("/settings")}><Settings className="mr-2 h-4 w-4 text-muted-foreground" />Settings</DropdownMenuItem>
            <DropdownMenuItem onClick={() => go(`/work/${ws}/notifications`)}><Bell className="mr-2 h-4 w-4 text-muted-foreground" />Notifications</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><Palette className="mr-2 h-4 w-4 text-muted-foreground" />Themes</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([v, label, I]) => (
                  <DropdownMenuItem key={v} onClick={() => setTheme(v)}>
                    <I className="mr-2 h-4 w-4 text-muted-foreground" />{label}
                    {theme === v && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => setKeysOpen(true)}><Keyboard className="mr-2 h-4 w-4 text-muted-foreground" />Keyboard shortcuts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">Personal tools</DropdownMenuLabel>
            {tree?.access.canEdit && <DropdownMenuItem onClick={() => openCreate(null)}><SquarePlus className="mr-2 h-4 w-4 text-muted-foreground" />Create task</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => go(`/work/${ws}`)}><ListChecks className="mr-2 h-4 w-4 text-muted-foreground" />My Work</DropdownMenuItem>
            <DropdownMenuItem onClick={() => go(`/work/${ws}/people`)}><Users className="mr-2 h-4 w-4 text-muted-foreground" />View People</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout.mutate()}><LogOut className="mr-2 h-4 w-4 text-muted-foreground" />Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} initialEmoji={statusEmoji} initialText={(user as any)?.chatStatusText} />

      <Dialog open={keysOpen} onOpenChange={setKeysOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle className="text-[17px] font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">Work keyboard shortcuts</DialogDescription>
          <ul className="space-y-2 text-[13px]">
            {[["Ctrl K", "Search Work"], ["Ctrl Enter", "Send a comment"], ["J / K", "Inbox: next / previous"], ["E", "Inbox: clear"], ["U", "Inbox: read / unread"], ["L", "Inbox: later"], ["Esc", "Close a task"]].map(([k, d]) => (
              <li key={k} className="flex items-center justify-between"><span>{d}</span><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd></li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusDialog({ open, onOpenChange, initialEmoji, initialText }: { open: boolean; onOpenChange: (o: boolean) => void; initialEmoji?: string; initialText?: string }) {
  const [emoji, setEmoji] = useState(initialEmoji ?? "🟢");
  const [text, setText] = useState(initialText ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setEmoji(initialEmoji ?? "🟢");
      setText(initialText ?? "");
    }
  }, [open, initialEmoji, initialText]);
  const save = async (clear = false) => {
    setBusy(true);
    try {
      await setUserStatus(clear ? null : emoji, clear ? null : text.trim() || null);
      toast.success(clear ? "Status cleared" : "Status set");
      onOpenChange(false);
      setTimeout(() => window.location.reload(), 400);
    } catch {
      toast.error("Couldn't set your status.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogTitle className="text-[17px] font-semibold">Set status</DialogTitle>
        <DialogDescription>Let your team know what you&apos;re up to.</DialogDescription>
        <div className="flex flex-wrap gap-1">
          {STATUS_EMOJIS.map((e) => (
            <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)} className={cn("h-9 w-9 rounded-md text-[18px]", emoji === e ? "bg-accent ring-1 ring-primary/40" : "hover:bg-accent")}>{e}</button>
          ))}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="What's your status?" aria-label="Status text" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="flex justify-between">
          <button type="button" onClick={() => save(true)} disabled={busy} className="text-[13px] text-muted-foreground hover:text-foreground">Clear status</button>
          <button type="button" onClick={() => save(false)} disabled={busy} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">Save</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
