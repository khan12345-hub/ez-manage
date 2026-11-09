"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowRight,
  AtSign,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Filter,
  Inbox as InboxIcon,
  Keyboard,
  Layers,
  ListChecks,
  MailOpen,
  MessageSquare,
  RotateCcw,
  Settings,
  Settings2,
  SlidersHorizontal,
  SortDesc,
  Eye,
  UserPlus,
  Activity,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { workApi, workKeys } from "@/services/work.api";
import { StatusGlyph } from "../../_components/primitives";
import { TaskDrawer } from "../../_components/TaskDrawer";
import { SnoozePicker } from "./SnoozePicker";
import { resolveUrl } from "@/lib/resolveUrl";
import {
  ALL_KINDS,
  BUCKET_ORDER,
  DEFAULT_SETTINGS,
  KIND_META,
  dateBucket,
  groupRows,
  kindOf,
  loadSettings,
  relDays,
  saveSettings,
  timeLabel,
  type InboxNotification,
  type InboxRow,
  type InboxSettings,
  type Kind,
} from "./inboxModel";

type Tab = "primary" | "other" | "later" | "cleared" | "all";

const KIND_ICON: Record<Kind, typeof Bell> = {
  mention: AtSign,
  assigned: UserPlus,
  assigned_comment: CheckCheck,
  reply: MessageSquare,
  comment: MessageSquare,
  status: Activity,
  overdue: CalendarClock,
  added: UserPlus,
};

export function InboxPage({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const taskUid = sp.get("task");

  const [settings, setSettingsState] = useState<InboxSettings>(DEFAULT_SETTINGS);
  useEffect(() => setSettingsState(loadSettings()), []);
  const setSettings = (s: InboxSettings) => {
    setSettingsState(s);
    saveSettings(s);
  };
  const [tab, setTab] = useState<Tab>("primary");
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [importanceOpen, setImportanceOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const [inlineKey, setInlineKey] = useState<string | null>(null);

  const view = tab === "later" ? "later" : tab === "cleared" ? "cleared" : "active";
  const { data, isLoading } = useQuery({ queryKey: ["work-inbox", view], queryFn: () => workApi.workInbox(view), refetchInterval: 60_000 });
  // the active set drives the Primary / Other unread counts even on Later / Cleared
  const { data: activeData } = useQuery({ queryKey: ["work-inbox", "active"], queryFn: () => workApi.workInbox("active"), refetchInterval: 60_000 });

  const important = useMemo(() => new Set(settings.important), [settings.important]);
  const split = useMemo(() => {
    const items = (activeData?.items ?? []) as InboxNotification[];
    return {
      primary: items.filter((n) => important.has(kindOf(n))),
      other: items.filter((n) => !important.has(kindOf(n))),
    };
  }, [activeData, important]);
  const unreadRows = (list: InboxNotification[]) => groupRows(list, true).filter((r) => r.unread).length;

  const source = useMemo(() => {
    const items = (data?.items ?? []) as InboxNotification[];
    if (tab === "primary") return items.filter((n) => important.has(kindOf(n)));
    if (tab === "other") return items.filter((n) => !important.has(kindOf(n)));
    return items;
  }, [data, tab, important]);
  const filtered = source.filter((n) => (!kinds.length || kinds.includes(kindOf(n))) && (!unreadOnly || !n.isRead));
  const rows = useMemo(() => groupRows(filtered, settings.newestFirst), [filtered, settings.newestFirst]);
  const sections = useMemo(() => {
    if (!settings.groupByDate) return [["", rows] as const];
    const m = new Map<string, InboxRow[]>();
    for (const r of rows) m.set(dateBucket(r.at), [...(m.get(dateBucket(r.at)) ?? []), r]);
    const order = settings.newestFirst ? BUCKET_ORDER : [...BUCKET_ORDER].reverse();
    return order.filter((b) => m.has(b)).map((b) => [b, m.get(b)!] as const);
  }, [rows, settings.groupByDate, settings.newestFirst]);
  const flat = sections.flatMap(([, r]) => r);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["work-inbox"] });
    qc.invalidateQueries({ queryKey: ["inbox"] });
  };
  const act = useMutation({
    mutationFn: ({ ids, action, until }: { ids: string[]; action: Parameters<typeof workApi.workInboxBulk>[1]; until?: string }) => workApi.workInboxBulk(ids, action, until),
    // instant: update every cached inbox view before the server answers
    onMutate: async ({ ids, action }) => {
      await qc.cancelQueries({ queryKey: ["work-inbox"] });
      const snapshot = qc.getQueriesData({ queryKey: ["work-inbox"] });
      const gone = new Set(ids);
      qc.setQueriesData<{ items: InboxNotification[]; counts: any }>({ queryKey: ["work-inbox"] }, (old) => {
        if (!old) return old;
        if (action === "read" || action === "unread") {
          return { ...old, items: old.items.map((n) => (gone.has(n.id) ? { ...n, isRead: action === "read" } : n)) };
        }
        return { ...old, items: old.items.filter((n) => !gone.has(n.id)) };
      });
      return { snapshot };
    },
    onSettled: () => invalidate(),
    onSuccess: (_r, v) => {
      if (v.action === "clear") toast.success("Cleared", { action: { label: "Undo", onClick: () => act.mutate({ ids: v.ids, action: "unclear" }) } });
      if (v.action === "snooze") toast.success("Moved to Later");
    },
    onError: (e: any, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't update the inbox.");
    },
  });

  const openRow = useCallback(
    (r: InboxRow) => {
      if (r.unread) act.mutate({ ids: r.ids, action: "read" });
      const uid = r.latest.metadata?.taskUid as string | undefined;
      if (!uid) {
        const url = r.latest.metadata?.url as string | undefined;
        if (url) router.push(url);
        return;
      }
      if (settings.display === "inline") {
        setInlineKey(r.key);
        return;
      }
      const next = new URLSearchParams(sp.toString());
      next.set("task", uid);
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [act, pathname, router, settings.display, sp],
  );
  const closeTask = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };
  const openTaskUid = (uid: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set("task", uid);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // keyboard shortcuts (ignored while typing or with the task open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (taskUid || t.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
      const r = flat[focus];
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => Math.min(flat.length - 1, f + 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => Math.max(0, f - 1)); }
      else if (e.key === "Enter" && r) openRow(r);
      else if (e.key === "e" && r && tab !== "cleared") act.mutate({ ids: r.ids, action: "clear" });
      else if (e.key === "u" && r) act.mutate({ ids: r.ids, action: r.unread ? "read" : "unread" });
      else if (e.key === "l" && r && tab !== "later") { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(8, 0, 0, 0); act.mutate({ ids: r.ids, action: "snooze", until: t.toISOString() }); }
      else if (e.key === "?") setKeysOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, focus, openRow, act, tab, taskUid]);
  useEffect(() => setFocus(0), [tab, kinds, unreadOnly]);

  const tabs: { id: Tab; label: string; icon: typeof Bell; sub?: string }[] = [
    { id: "primary", label: "Primary", icon: InboxIcon, sub: `${unreadRows(split.primary)} unread` },
    { id: "other", label: "Other", icon: Activity, sub: `${unreadRows(split.other)} unread` },
    { id: "later", label: "Later", icon: AlarmClock, sub: activeData?.counts.later ? `${activeData.counts.later}` : undefined },
    { id: "cleared", label: "Cleared", icon: CheckCheck },
    ...(settings.showAll ? [{ id: "all" as Tab, label: "All", icon: Layers }] : []),
  ];
  const clearable = tab === "primary" || tab === "other" || tab === "all";
  const inlineRow = settings.display === "inline" ? flat.find((r) => r.key === inlineKey) ?? null : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* tabs */}
      <div role="tablist" aria-label="Inbox" className="flex shrink-0 border-b border-border bg-card">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 border-b-2 px-5 py-3 text-left transition-colors sm:max-w-[260px]",
              tab === t.id ? "border-foreground" : "border-transparent hover:bg-accent/40",
              "[&:not(:last-child)]:border-r [&:not(:last-child)]:border-r-border/60",
            )}
          >
            <t.icon className={cn("h-4 w-4 shrink-0", tab === t.id ? "text-foreground" : "text-muted-foreground")} />
            <span className="min-w-0">
              <span className={cn("block text-[14px] font-semibold", tab === t.id ? "text-foreground" : "text-muted-foreground")}>{t.label}</span>
              {t.sub && <span className="block text-[11.5px] text-muted-foreground">{t.sub}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-2 px-5 py-2.5">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={cn("flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium", kinds.length || unreadOnly ? "border-primary/40 bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              <Filter className="h-3.5 w-3.5" /> Filter
              {(kinds.length > 0 || unreadOnly) && <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{kinds.length + (unreadOnly ? 1 : 0)}</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1.5">
            <label className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
              Unread only <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} aria-label="Unread only" />
            </label>
            <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Type</p>
            {ALL_KINDS.map((k) => {
              const I = KIND_ICON[k];
              const on = kinds.includes(k);
              return (
                <button key={k} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => setKinds(on ? kinds.filter((x) => x !== k) : [...kinds, k])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                  <I className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{KIND_META[k].label}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
            {(kinds.length > 0 || unreadOnly) && (
              <button type="button" onClick={() => { setKinds([]); setUnreadOnly(false); }} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-accent">Clear filters</button>
            )}
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <button type="button" aria-label="Customize Inbox" title="Customize Inbox" onClick={() => setCustomize(true)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </button>
        {clearable && rows.length > 0 && (
          <button type="button" onClick={() => act.mutate({ ids: rows.flatMap((r) => r.ids), action: "clear" })} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
            <CheckCheck className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      {/* list (+ inline preview) */}
      <div className="flex min-h-0 flex-1">
        <div className={cn("min-h-0 overflow-y-auto px-5 pb-8", inlineRow ? "w-[46%] shrink-0 border-r border-border" : "flex-1")}>
          {isLoading ? (
            <div className="space-y-2 pt-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)}</div>
          ) : rows.length === 0 ? (
            <Empty tab={tab} filtered={kinds.length > 0 || unreadOnly} />
          ) : (
            sections.map(([label, list]) => (
              <section key={label || "all"} aria-label={label || "Notifications"} className="mb-4">
                {label && <h2 className="px-1 pb-2 pt-3 text-[13.5px] font-semibold">{label}</h2>}
                <ul className="overflow-hidden rounded-xl border border-border bg-card">
                  {list.map((r) => {
                    const idx = flat.indexOf(r);
                    return (
                      <Row
                        key={r.key}
                        row={r}
                        tab={tab}
                        compact={!!inlineRow}
                        focused={idx === focus}
                        selected={inlineRow?.key === r.key}
                        onOpen={() => { setFocus(idx); openRow(r); }}
                        onAct={(action, until) => act.mutate({ ids: r.ids, action, until })}
                      />
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        {inlineRow && <InlinePreview row={inlineRow} onOpen={(uid) => openTaskUid(uid)} onClose={() => setInlineKey(null)} />}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={closeTask} onOpenTask={openTaskUid} />

      {/* Customize Inbox */}
      <Sheet open={customize} onOpenChange={setCustomize}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:sm:max-w-[340px]">
          <div className="border-b border-border px-5 py-4">
            <SheetTitle className="text-[15px] font-semibold">Customize Inbox</SheetTitle>
            <SheetDescription className="sr-only">Inbox display and importance settings</SheetDescription>
          </div>
          <div className="space-y-1 border-b border-border px-3 py-3">
            <ToggleRow icon={Eye} label="Show All tab" checked={settings.showAll} onChange={(v) => setSettings({ ...settings, showAll: v })} />
            <ToggleRow icon={Layers} label="Group by date" checked={settings.groupByDate} onChange={(v) => setSettings({ ...settings, groupByDate: v })} />
            <ToggleRow icon={SortDesc} label="Sort by newest first" checked={settings.newestFirst} onChange={(v) => setSettings({ ...settings, newestFirst: v })} />
          </div>
          <div className="border-b border-border px-3 py-3">
            <p className="px-2 pb-1 text-[12px] font-medium text-muted-foreground">Important notifications</p>
            <button type="button" onClick={() => setImportanceOpen(true)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13.5px] hover:bg-accent">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Customize importance</span>
              <span className="text-[12px] text-muted-foreground">{settings.important.length}/{ALL_KINDS.length}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="border-b border-border px-5 py-3">
            <p className="pb-2 text-[12px] font-medium text-muted-foreground">Display mode</p>
            <div className="grid grid-cols-2 gap-3">
              {(["fullscreen", "inline"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={settings.display === m} onClick={() => { setSettings({ ...settings, display: m }); setInlineKey(null); }} className="text-left">
                  <span className={cn("relative flex h-24 items-center justify-center rounded-xl border-2 bg-muted/40", settings.display === m ? "border-foreground" : "border-border")}>
                    {m === "fullscreen" ? (
                      <span className="flex h-14 w-16 flex-col gap-1 rounded-md border border-border bg-card p-1.5"><span className="h-1 w-8 rounded bg-muted-foreground/40" /><span className="h-1 w-10 rounded bg-muted-foreground/30" /><span className="h-1 w-6 rounded bg-muted-foreground/30" /></span>
                    ) : (
                      <span className="flex h-14 w-20 gap-1"><span className="flex w-1/2 flex-col gap-1 rounded-md border border-border bg-card p-1"><span className="h-1 rounded bg-muted-foreground/40" /><span className="h-1 rounded bg-muted-foreground/30" /></span><span className="w-1/2 rounded-md border border-border bg-card" /></span>
                    )}
                    {settings.display === m && <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"><Check className="h-2.5 w-2.5" /></span>}
                  </span>
                  <span className="mt-1.5 block text-[13px] font-medium capitalize">{m}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 py-3">
            <button type="button" onClick={() => router.push("/settings")} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13.5px] hover:bg-accent"><Settings2 className="h-4 w-4 text-muted-foreground" /> Notification settings</button>
            <button type="button" onClick={() => setKeysOpen(true)} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13.5px] hover:bg-accent"><Keyboard className="h-4 w-4 text-muted-foreground" /> Keyboard shortcuts</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* importance */}
      <Dialog open={importanceOpen} onOpenChange={setImportanceOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogTitle className="text-[17px] font-semibold">Customize importance</DialogTitle>
          <DialogDescription>Important notifications go to Primary. Everything else goes to Other.</DialogDescription>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {ALL_KINDS.map((k) => {
              const I = KIND_ICON[k];
              const on = settings.important.includes(k);
              return (
                <li key={k} className="flex items-center gap-3 px-3 py-2.5">
                  <I className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{KIND_META[k].label}</span>
                    <span className="block text-[12px] text-muted-foreground">{KIND_META[k].hint}</span>
                  </span>
                  <Switch aria-label={`${KIND_META[k].label} is important`} checked={on} onCheckedChange={(v) => setSettings({ ...settings, important: v ? [...settings.important, k] : settings.important.filter((x) => x !== k) })} />
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => setSettings({ ...settings, important: DEFAULT_SETTINGS.important })} className="mt-1 self-start text-[12.5px] text-muted-foreground hover:text-foreground">Reset to default</button>
        </DialogContent>
      </Dialog>

      {/* shortcuts */}
      <Dialog open={keysOpen} onOpenChange={setKeysOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogTitle className="text-[17px] font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">Inbox keyboard shortcuts</DialogDescription>
          <ul className="space-y-2 text-[13px]">
            {[["J / ↓", "Next item"], ["K / ↑", "Previous item"], ["Enter", "Open"], ["E", "Clear"], ["U", "Mark read / unread"], ["L", "Later (tomorrow 8 AM)"], ["?", "Show shortcuts"]].map(([k, d]) => (
              <li key={k} className="flex items-center justify-between"><span>{d}</span><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd></li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({ icon: I, label, checked, onChange }: { icon: typeof Bell; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13.5px] hover:bg-accent">
      <I className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

/** What happened, ClickUp-style: actor + action + detail. */
function EventText({ n }: { n: InboxNotification }) {
  const k = kindOf(n);
  const actor = n.metadata?.actorName as string | undefined;
  const avatar = n.metadata?.actorAvatar as string | undefined;
  const initials = (actor ?? "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const chip = (text: string) => (
    <span className="ml-1.5 inline-flex max-w-[380px] items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-0.5 align-middle text-[12.5px] text-foreground/90">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveUrl(avatar)} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-forest text-[7.5px] font-bold text-forest-foreground">{initials}</span>
      )}
      <span className="truncate">{text}</span>
    </span>
  );
  switch (k) {
    case "status":
      return (
        <span className="truncate">
          <span className="font-medium">{actor || "Someone"}</span> changed status:{" "}
          <span className="inline-flex items-center gap-1 align-middle"><i className="h-2 w-2 rounded-[2px]" style={{ background: n.metadata?.fromColor ?? "#9CA3AF" }} />{n.metadata?.from ?? "none"}</span>
          <ArrowRight className="mx-1 inline h-3 w-3" />
          <span className="inline-flex items-center gap-1 align-middle font-medium"><i className="h-2 w-2 rounded-[2px]" style={{ background: n.metadata?.toColor ?? "#9CA3AF" }} />{n.metadata?.to ?? "none"}</span>
        </span>
      );
    case "overdue":
      return <span className="truncate text-muted-foreground">Task is overdue. Due date was <b className="font-semibold text-destructive">{relDays(n.metadata?.dueDate ?? n.createdAt)}</b></span>;
    case "assigned":
      return <span className="truncate"><span className="font-medium">{actor || "Someone"}</span> assigned this task to you</span>;
    case "added":
      return <span className="truncate text-muted-foreground">{n.message}</span>;
    case "mention":
      return <span className="truncate"><span className="font-medium">{actor || "Someone"}</span> mentioned you:{chip(n.message)}</span>;
    case "assigned_comment":
      return <span className="truncate"><span className="font-medium">{actor || "Someone"}</span> assigned you a comment:{chip(n.message)}</span>;
    case "reply":
      return <span className="truncate"><span className="font-medium">{actor || "Someone"}</span> replied:{chip(n.message)}</span>;
    default:
      return <span className="truncate"><span className="font-medium">{actor || "Someone"}</span> commented:{chip(n.message)}</span>;
  }
}

function Row({
  row,
  tab,
  compact,
  focused,
  selected,
  onOpen,
  onAct,
}: {
  row: InboxRow;
  tab: Tab;
  compact: boolean;
  focused: boolean;
  selected: boolean;
  onOpen: () => void;
  onAct: (action: "clear" | "unclear" | "snooze" | "unsnooze" | "read" | "unread", until?: string) => void;
}) {
  const n = row.latest;
  const k = kindOf(n);
  const I = KIND_ICON[k];
  const name = n.task?.name ?? n.metadata?.taskName ?? n.title;
  return (
    <li
      data-focused={focused || undefined}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 border-b border-border/70 px-4 py-[11px] text-[14px] leading-5 transition-colors last:border-b-0 hover:bg-accent/40",
        row.unread ? "bg-card" : "bg-muted/25",
        focused && "ring-1 ring-inset ring-primary/40",
        selected && "bg-accent/60",
      )}
      onClick={onOpen}
    >
      {/* task */}
      <span className={cn("flex min-w-0 items-center gap-2.5", compact ? "w-1/2" : "w-[clamp(240px,30vw,460px)] shrink-0")}>
        {n.task?.status ? <StatusGlyph status={n.task.status} size={15} /> : k === "added" ? <UserPlus className="h-4 w-4 text-muted-foreground" /> : <ListChecks className="h-4 w-4 text-muted-foreground" />}
        <span className={cn("truncate", row.unread ? "text-foreground" : "text-foreground/65", n.task?.completedAt && "line-through decoration-muted-foreground/50")}>{name}</span>
      </span>
      {/* event */}
      <span className={cn("flex min-w-0 flex-1 items-center gap-2.5", row.unread ? "text-foreground/80" : "text-muted-foreground")}>
        <I className={cn("h-4 w-4 shrink-0", k === "mention" ? "text-[#7C3AED]" : "text-muted-foreground")} />
        {!compact && <EventText n={n} />}
        {compact && <span className="truncate text-[12.5px] text-muted-foreground">{KIND_META[k].label}</span>}
      </span>
      {tab === "later" && n.snoozedUntil && <span className="hidden shrink-0 items-center gap-1 text-[11.5px] text-[#8a6a3a] sm:flex dark:text-brass-soft"><AlarmClock className="h-3 w-3" />{new Date(n.snoozedUntil).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>}
      {row.events.length > 1 && <span className="shrink-0 rounded-full border border-border px-1.5 font-mono text-[10.5px] text-muted-foreground" title={`${row.events.length} updates`}>{row.events.length}</span>}
      <span className="w-20 shrink-0 text-right text-[12.5px] text-muted-foreground group-hover:invisible">{timeLabel(row.at)}</span>

      {/* hover actions */}
      <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
        <IconBtn label={row.unread ? "Mark read" : "Mark unread"} onClick={() => onAct(row.unread ? "read" : "unread")}>{row.unread ? <MailOpen className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</IconBtn>
        {tab === "later" ? (
          <IconBtn label="Back to inbox" onClick={() => onAct("unsnooze")}><BellOff className="h-4 w-4" /></IconBtn>
        ) : tab !== "cleared" ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Later" title="Later" className="flex h-7 w-7 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"><AlarmClock className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <SnoozePicker onPick={(at) => onAct("snooze", at.toISOString())} />
            </PopoverContent>
          </Popover>
        ) : null}
        {tab === "cleared" ? (
          <button type="button" onClick={() => onAct("unclear")} className="flex h-7 items-center gap-1 rounded-md bg-card px-2.5 text-[12.5px] font-medium ring-1 ring-border hover:bg-accent"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
        ) : (
          <button type="button" onClick={() => onAct("clear")} className="flex h-7 items-center gap-1 rounded-md bg-forest px-2.5 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground"><Check className="h-3.5 w-3.5" /> Clear</button>
        )}
      </span>
    </li>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md bg-card text-muted-foreground ring-1 ring-border hover:text-foreground">
      {children}
    </button>
  );
}

/** Inline display mode: the selected notification's task on the right. */
function InlinePreview({ row, onOpen, onClose }: { row: InboxRow; onOpen: (uid: string) => void; onClose: () => void }) {
  const uid = row.latest.metadata?.taskUid as string;
  const { data: task } = useQuery({ queryKey: workKeys.task(uid), queryFn: () => workApi.getTask(uid), enabled: !!uid, retry: false });
  const status = task?.statuses.find((s) => s.id === task.statusId);
  return (
    <aside aria-label="Task preview" className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-6 py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">{task?.list.space.name} / {task?.list.name}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => onOpen(uid)} className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[12.5px] font-medium hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /> Open task</button>
        <button type="button" aria-label="Close preview" onClick={onClose} className="rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-accent">Close</button>
      </div>
      {!task ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : (
        <>
          <h2 className="font-serif text-[26px] leading-tight">{task.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            {status && <span className="flex items-center gap-1.5"><StatusGlyph status={status} size={13} />{status.name}</span>}
            {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
            {task.assignees.length > 0 && <span>{task.assignees.map((a) => a.firstName).join(", ")}</span>}
          </div>
          {task.description && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed">{task.description}</p>}
          <h3 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Updates in this row</h3>
          <ul className="space-y-2">
            {row.events.map((e) => (
              <li key={e.id} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1"><EventText n={e} /></span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{timeLabel(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function Empty({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  const [title, body] = filtered
    ? ["Nothing matches", "Try a different filter."]
    : {
        primary: ["Inbox zero", "Nothing important needs you right now."],
        other: ["All caught up", "Less important updates land here."],
        later: ["Nothing snoozed", "Use Later (the clock) and items come back when you choose."],
        cleared: ["Nothing cleared yet", "Items you clear move here, so you can always find them again."],
        all: ["Inbox zero", "Nothing needs you right now."],
      }[tab];
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-[#b08d57]/10 text-primary"><CircleAlert className="h-6 w-6" /></span>
      <p className="font-serif text-[22px]">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
