"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import { workApi } from "@/services/work.api";
import { StatusGlyph } from "../../_components/primitives";
import { TaskDrawer } from "../../_components/TaskDrawer";
import { kindOf, timeLabel, type InboxNotification } from "../inbox/inboxModel";

/** Replies (ClickUp): replies in threads you're part of — Unread / Read. */
function RepliesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const taskUid = sp.get("task");
  const qc = useQueryClient();
  const [tab, setTab] = useState<"unread" | "read">("unread");
  const { data, isLoading } = useQuery({ queryKey: ["work-inbox", "all"], queryFn: () => workApi.workInbox("all") });
  const replies = useMemo(() => ((data?.items ?? []) as InboxNotification[]).filter((n) => kindOf(n) === "reply"), [data]);
  const rows = replies.filter((n) => (tab === "unread" ? !n.isRead : n.isRead));
  const unread = replies.filter((n) => !n.isRead).length;

  const mark = useMutation({
    mutationFn: ({ ids, read }: { ids: string[]; read: boolean }) => workApi.workInboxBulk(ids, read ? "read" : "unread"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-inbox"] });
    },
  });
  const setTask = (uid: string | null) => {
    const next = new URLSearchParams(sp.toString());
    uid ? next.set("task", uid) : next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="flex items-center border-b border-border bg-card pr-4">
        <div role="tablist" aria-label="Replies" className="flex flex-1">
          {(["unread", "read"] as const).map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("flex items-center gap-2 border-b-2 px-6 py-3.5 text-[14px] font-semibold capitalize", tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-accent/40")}>
              {t}
              {t === "unread" && unread > 0 && <span className="rounded-full bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">{unread}</span>}
            </button>
          ))}
        </div>
        {tab === "unread" && rows.length > 0 && (
          <button type="button" onClick={() => mark.mutate({ ids: rows.map((r) => r.id), read: true })} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary"><MessageSquareReply className="h-6 w-6" /></span>
            <p className="font-serif text-[22px]">{tab === "unread" ? "No unread replies" : "No read replies yet"}</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Replies to your comments, and in threads you joined, show up here.</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {rows.map((n) => {
              const avatar = n.metadata?.actorAvatar as string | undefined;
              return (
                <li key={n.id} className={cn("flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 hover:bg-accent/30", n.isRead && "bg-muted/25")}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.isRead) mark.mutate({ ids: [n.id], read: true });
                      if (n.metadata?.taskUid) setTask(n.metadata.taskUid);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {n.task?.status ? <StatusGlyph status={n.task.status} size={15} /> : <MessageSquareReply className="h-4 w-4 text-muted-foreground" />}
                    <span className="w-[clamp(200px,28vw,380px)] shrink-0 truncate text-[14px]">{n.task?.name ?? n.metadata?.taskName}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-[13.5px] text-foreground/80">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveUrl(avatar)} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : null}
                      <span className="font-medium">{n.metadata?.actorName || "Someone"}</span> replied:
                      <span className="truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-[12.5px]">{n.message}</span>
                    </span>
                  </button>
                  <span className="w-20 shrink-0 text-right text-[12.5px] text-muted-foreground">{timeLabel(n.createdAt)}</span>
                  <button type="button" onClick={() => mark.mutate({ ids: [n.id], read: !n.isRead })} className="shrink-0 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">
                    {n.isRead ? "Mark unread" : "Mark read"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setTask(null)} onOpenTask={(uid) => setTask(uid)} />
    </div>
  );
}

export default function RepliesPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <RepliesInner />
    </Suspense>
  );
}
