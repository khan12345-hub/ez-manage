"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlarmClock,
  AtSign,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CircleCheckBig,
  Clock,
  Inbox as InboxIcon,
  MailOpen,
  MessageSquare,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { workApi, type InboxItem, type InboxTab } from "@/services/work.api";
import { getNotificationUrl } from "@/app/layouts/AppShell/TopNavbar/Notifications";

const TABS: { id: InboxTab; label: string; icon: typeof InboxIcon }[] = [
  { id: "primary", label: "Primary", icon: InboxIcon },
  { id: "later", label: "Later", icon: AlarmClock },
  { id: "cleared", label: "Cleared", icon: CircleCheckBig },
];

type Kind = "all" | "mentions" | "assigned" | "comments";
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "assigned", label: "Assigned to me" },
  { id: "comments", label: "Comments" },
];

const kindOf = (n: InboxItem): Kind =>
  n.type === "COMMENT_MENTION" ? "mentions" : n.type === "TASK_ASSIGNED" || n.metadata?.assignedComment ? "assigned" : n.type.startsWith("COMMENT") || n.type === "FILE_COMMENT" ? "comments" : "all";

function TypeIcon({ n }: { n: InboxItem }) {
  const k = kindOf(n);
  const [I, cls] =
    k === "mentions" ? [AtSign, "bg-[#7C3AED]/12 text-[#7C3AED]"]
    : k === "assigned" ? [UserPlus, "bg-[#b08d57]/15 text-[#8a6a3a] dark:text-brass-soft"]
    : k === "comments" ? [MessageSquare, "bg-primary/10 text-primary"]
    : [Bell, "bg-muted text-muted-foreground"];
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}>
      <I className="h-4 w-4" />
    </span>
  );
}

function bucket(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const diff = (t.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000;
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Last 7 days";
  return "Earlier";
}
const ORDER = ["Today", "Yesterday", "Last 7 days", "Earlier"];

function when(iso: string) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400 && d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function snoozeOptions() {
  const now = new Date();
  const later = new Date(now.getTime() + 3 * 3600_000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [
    { label: "Later today", hint: later.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), at: later },
    { label: "Tomorrow", hint: "9:00 AM", at: tomorrow },
    { label: "Next week", hint: `Mon 9:00 AM`, at: monday },
  ];
}

export default function InboxPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<InboxTab>("primary");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [kind, setKind] = useState<Kind>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["inbox", tab, unreadOnly],
    queryFn: () => workApi.inbox(tab, { unread: unreadOnly }),
    refetchInterval: 60_000,
  });
  const items = useMemo(() => (data?.items ?? []).filter((n) => kind === "all" || kindOf(n) === kind), [data, kind]);
  const groups = useMemo(() => {
    const m = new Map<string, InboxItem[]>();
    for (const n of items) m.set(bucket(n.createdAt), [...(m.get(bucket(n.createdAt)) ?? []), n]);
    return ORDER.filter((k) => m.has(k)).map((k) => [k, m.get(k)!] as const);
  }, [items]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["inbox"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const act = useMutation({
    mutationFn: ({ n, action, until }: { n: InboxItem; action: Parameters<typeof workApi.inboxAction>[1]; until?: string }) => workApi.inboxAction(n.id, action, until),
    onSuccess: (_d, v) => {
      invalidate();
      if (v.action === "clear") toast.success("Cleared", { action: { label: "Undo", onClick: () => act.mutate({ n: v.n, action: "unclear" }) } });
      if (v.action === "snooze") toast.success(`Moved to Later`);
    },
    onError: () => toast.error("Couldn't update that notification."),
  });
  const clearAll = useMutation({ mutationFn: () => workApi.inboxClearAll(), onSuccess: () => { invalidate(); toast.success("Inbox cleared"); } });
  const readAll = useMutation({ mutationFn: async () => { for (const n of items.filter((x) => !x.isRead)) await workApi.inboxAction(n.id, "read"); }, onSuccess: invalidate });

  const open = async (n: InboxItem) => {
    if (!n.isRead) act.mutate({ n, action: "read" });
    const url = await getNotificationUrl(n as any);
    if (url) router.push(url);
    else toast.message("This item has no page to open.");
  };

  const counts = data?.counts;
  const unreadHere = items.filter((n) => !n.isRead).length;

  return (
    <div className="flex min-h-full w-full flex-col px-4 py-6 sm:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden /> Work
          </p>
          <h1 className="font-serif text-[34px] leading-tight tracking-tight">Inbox</h1>
          <p className="text-[13px] text-muted-foreground">Mentions, assignments and comments on your work. Clear what&apos;s done, snooze what can wait.</p>
        </div>
        {tab === "primary" && items.length > 0 && (
          <div className="flex gap-2">
            {unreadHere > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button type="button" onClick={() => clearAll.mutate()} className="flex h-8 items-center gap-1.5 rounded-md bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 dark:bg-primary dark:text-primary-foreground">
              <Check className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        )}
      </header>

      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_12px_32px_-20px_rgb(11_42_31/0.25)]">
        {/* tabs */}
        <div role="tablist" aria-label="Inbox" className="flex items-center gap-1 border-b border-border px-3">
          {TABS.map((t) => {
            const c = t.id === "primary" ? counts?.primaryUnread : t.id === "later" ? counts?.later : undefined;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13.5px] font-medium", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                <t.icon className="h-4 w-4" /> {t.label}
                {!!c && <span className={cn("rounded-full px-1.5 font-mono text-[10.5px]", t.id === "primary" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{c}</span>}
              </button>
            );
          })}
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-table-head px-4 py-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium", kind === k.id ? "bg-forest text-forest-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground")}>
              {k.label}
            </button>
          ))}
          <span className="flex-1" />
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-[var(--primary)]" /> Unread only
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
        ) : items.length === 0 ? (
          <Empty tab={tab} />
        ) : (
          groups.map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="sticky top-0 z-[1] bg-card/95 px-5 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">{label}</h2>
              <ul>
                {list.map((n) => (
                  <li key={n.id} className={cn("group relative flex items-start gap-3 border-b border-border/60 px-5 py-3 transition-colors last:border-b-0 hover:bg-accent/30", !n.isRead && "bg-primary/[0.035]")}>
                    {!n.isRead && <span aria-label="Unread" className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />}
                    <TypeIcon n={n} />
                    <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-baseline gap-2">
                        <span className={cn("truncate text-[13.5px]", n.isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>{n.title}</span>
                        {n.metadata?.actorName && <span className="truncate text-[12px] text-muted-foreground">by {n.metadata.actorName}</span>}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">{n.message}</span>
                      {n.metadata?.taskName && (
                        <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-[11.5px]">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-product-work" />
                          <span className="truncate text-muted-foreground">{n.metadata.listName}</span>
                          <span className="text-muted-foreground/60">/</span>
                          <span className="truncate font-medium">{n.metadata.taskName}</span>
                        </span>
                      )}
                      {tab === "later" && n.snoozedUntil && (
                        <span className="mt-1 flex items-center gap-1 text-[11.5px] text-[#8a6a3a] dark:text-brass-soft"><Clock className="h-3 w-3" /> Back {new Date(n.snoozedUntil).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                      )}
                    </button>
                    <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground group-hover:hidden">{when(n.createdAt)}</span>
                    <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
                      <Action label={n.isRead ? "Mark unread" : "Mark read"} onClick={() => act.mutate({ n, action: n.isRead ? "unread" : "read" })}>
                        {n.isRead ? <Bell className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                      </Action>
                      {tab === "later" ? (
                        <Action label="Back to Primary" onClick={() => act.mutate({ n, action: "unsnooze" })}><BellOff className="h-3.5 w-3.5" /></Action>
                      ) : tab === "primary" ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" aria-label="Snooze" title="Later" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"><AlarmClock className="h-3.5 w-3.5" /></button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-52 p-1">
                            <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Remind me</p>
                            {snoozeOptions().map((o) => (
                              <button key={o.label} type="button" onClick={() => act.mutate({ n, action: "snooze", until: o.at.toISOString() })} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-accent">
                                {o.label} <span className="text-[11.5px] text-muted-foreground">{o.hint}</span>
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      ) : null}
                      {tab === "cleared" ? (
                        <Action label="Restore" onClick={() => act.mutate({ n, action: "unclear" })}><RotateCcw className="h-3.5 w-3.5" /></Action>
                      ) : (
                        <Action label="Clear" onClick={() => act.mutate({ n, action: "clear" })} primary><Check className="h-3.5 w-3.5" /></Action>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Action({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn("flex h-7 w-7 items-center justify-center rounded-md", primary ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-card hover:text-foreground")}>
      {children}
    </button>
  );
}

function Empty({ tab }: { tab: InboxTab }) {
  const copy = {
    primary: ["Inbox zero", "Nothing needs you right now. New mentions, assignments and comments land here."],
    later: ["Nothing snoozed", "Snooze an item with the clock icon and it comes back when you choose."],
    cleared: ["Nothing cleared yet", "Items you clear move here, so you can always find them again."],
  }[tab];
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-[#b08d57]/10 text-primary">
        <CircleCheckBig className="h-6 w-6" />
      </span>
      <p className="font-serif text-[22px]">{copy[0]}</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{copy[1]}</p>
    </div>
  );
}
