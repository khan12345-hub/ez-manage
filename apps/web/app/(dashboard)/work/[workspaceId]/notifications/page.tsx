"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, ArrowLeft, AtSign, Bell, CalendarClock, CheckCheck, Inbox, Mail, MessageSquare, MonitorSmartphone, Reply, SmilePlus, UserPlus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { workApi, type NotificationKind, type NotificationPref } from "@/services/work.api";

const KINDS: { kind: NotificationKind; label: string; hint: string; icon: typeof Bell }[] = [
  { kind: "mention", label: "Mentions", hint: "Someone @mentions you in a comment", icon: AtSign },
  { kind: "assigned", label: "Assigned to me", hint: "A task is assigned to you", icon: UserPlus },
  { kind: "assigned_comment", label: "Assigned comments", hint: "A comment is assigned to you", icon: CheckCheck },
  { kind: "reply", label: "Replies", hint: "Someone replies in a thread on your task", icon: Reply },
  { kind: "comment", label: "Comments", hint: "New comments on tasks you created or are assigned to", icon: MessageSquare },
  { kind: "reaction", label: "Reactions", hint: "Someone reacts to your comment", icon: SmilePlus },
  { kind: "status", label: "Status changes", hint: "The status of your task changes", icon: Activity },
  { kind: "overdue", label: "Overdue tasks", hint: "Your task passes its due date", icon: CalendarClock },
];
const CHANNELS = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "email", label: "Email", icon: Mail },
  { key: "browser", label: "Browser", icon: MonitorSmartphone },
] as const;
type Channel = (typeof CHANNELS)[number]["key"];

/** Work notification settings: per event, choose Inbox / Email / Browser (like ClickUp). */
export default function WorkNotificationSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const qc = useQueryClient();
  const KEY = ["work", "notification-settings"];
  const { data = [], isLoading } = useQuery({ queryKey: KEY, queryFn: workApi.notificationSettings });
  const push = usePushNotifications();
  const save = useMutation({
    mutationFn: (p: NotificationPref) => workApi.setNotificationSetting(p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<NotificationPref[]>(KEY);
      qc.setQueryData<NotificationPref[]>(KEY, (old) => old?.map((x) => (x.kind === p.kind ? p : x)));
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      qc.setQueryData(KEY, ctx?.prev);
      toast.error("Couldn't save that setting.");
    },
  });
  const byKind = new Map(data.map((p) => [p.kind, p]));
  const prefOf = (k: NotificationKind): NotificationPref => byKind.get(k) ?? { kind: k, inbox: true, email: false, browser: true };
  const setAll = (channel: Channel, value: boolean) => {
    for (const k of KINDS) {
      const p = prefOf(k.kind);
      if (p[channel] !== value) save.mutate({ ...p, [channel]: value });
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col px-4 py-6 sm:px-8">
      <Link href={`/work/${workspaceId}/inbox`} className="mb-3 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Inbox
      </Link>
      <header className="mb-5">
        <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-product-work" aria-hidden /> Work
        </p>
        <h1 className="font-serif text-[34px] leading-tight tracking-tight">Notification settings</h1>
        <p className="text-[13px] text-muted-foreground">Choose where each kind of Work update reaches you. These settings are only for Work; Boards has its own.</p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.04),0_12px_32px_-20px_rgb(11_42_31/0.25)]">
        <div className="grid grid-cols-[minmax(260px,1fr)_110px_110px_110px] items-center border-b border-border bg-table-head px-5 py-2.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">Notify me about</span>
          {CHANNELS.map((c) => {
            const allOn = KINDS.every((k) => prefOf(k.kind)[c.key]);
            return (
              <button key={c.key} type="button" onClick={() => setAll(c.key, !allOn)} title={allOn ? `Turn ${c.label} off for all` : `Turn ${c.label} on for all`} className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold hover:text-primary">
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" /> {c.label}
              </button>
            );
          })}
        </div>
        {isLoading && <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)}</div>}
        {!isLoading &&
          KINDS.map((k) => {
            const p = prefOf(k.kind);
            return (
              <div key={k.kind} className="grid grid-cols-[minmax(260px,1fr)_110px_110px_110px] items-center border-b border-border/70 px-5 py-3 last:border-b-0">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><k.icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{k.label}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{k.hint}</span>
                  </span>
                </span>
                {CHANNELS.map((c) => (
                  <span key={c.key} className="flex justify-center">
                    <Switch aria-label={`${k.label}: ${c.label}`} checked={p[c.key]} onCheckedChange={(v) => save.mutate({ ...p, [c.key]: v })} />
                  </span>
                ))}
              </div>
            );
          })}
      </section>

      <section className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
        <MonitorSmartphone className="h-5 w-5 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Browser notifications on this device</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {push.state === "granted"
              ? "Allowed. Updates set to Browser pop up even when this tab is in the background."
              : push.state === "denied"
                ? "Blocked in your browser settings. Allow notifications for this site to get them."
                : "Allow this browser to show Work updates as pop-ups."}
          </span>
        </span>
        {push.state !== "granted" && push.state !== "denied" && (
          <button type="button" onClick={() => push.enable()} disabled={push.loading} className="rounded-lg bg-forest px-3.5 py-2 text-[13px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">
            Enable
          </button>
        )}
      </section>
      <p className="mt-3 text-[12px] text-muted-foreground">Email goes to your account email. If a kind is off for both Inbox and Email, it is not sent at all.</p>
    </div>
  );
}
