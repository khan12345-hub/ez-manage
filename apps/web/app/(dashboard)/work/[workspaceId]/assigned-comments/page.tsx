"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, MessageSquare, RotateCcw, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi } from "@/services/work.api";
import { Avatar } from "../../_components/primitives";
import { TaskDrawer } from "../../_components/TaskDrawer";

type Mode = "to-me" | "by-me";

function when(iso: string) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Assigned Comments (ClickUp): comments assigned to me / delegated by me, resolve in place. */
function AssignedCommentsInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const taskUid = sp.get("task");
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("to-me");
  const [showResolved, setShowResolved] = useState(false);
  const [q, setQ] = useState("");
  const key = ["work", "assigned-comments", workspaceId, mode, showResolved];
  const { data = [], isLoading } = useQuery({ queryKey: key, queryFn: () => workApi.assignedComments(workspaceId, mode, showResolved) });
  const { data: counts } = useQuery({
    queryKey: ["work", "assigned-comments", workspaceId, "counts"],
    queryFn: async () => ({ toMe: (await workApi.assignedComments(workspaceId, "to-me", false)).length, byMe: (await workApi.assignedComments(workspaceId, "by-me", false)).length }),
  });
  const { data: chat = [] } = useQuery({ queryKey: ["work", "chat-assigned", workspaceId, showResolved], queryFn: () => workApi.chatAssigned(workspaceId, showResolved), enabled: mode === "to-me" });
  const chatRows = chat.filter((m) => !q.trim() || `${m.content} ${m.channel?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  const resolveChat = useMutation({
    mutationFn: (m: (typeof chat)[number]) => workApi.chatResolve(m.id, !m.resolvedAt),
    onSuccess: (_r, m) => { qc.invalidateQueries({ queryKey: ["work", "chat-assigned", workspaceId] }); toast.success(m.resolvedAt ? "Reopened" : "Resolved"); },
    onError: () => toast.error("Couldn't update that message."),
  });
  const term = q.trim().toLowerCase();
  const rows = useMemo(() => (data as any[]).filter((c) => !term || `${c.content} ${c.task.name} ${c.task.list.name}`.toLowerCase().includes(term)), [data, term]);

  const toggle = useMutation({
    mutationFn: (c: any) => (c.resolvedAt ? workApi.reopenComment(c.id) : workApi.resolveComment(c.id)),
    onSuccess: (_r, c: any) => {
      qc.invalidateQueries({ queryKey: ["work", "assigned-comments", workspaceId] });
      toast.success(c.resolvedAt ? "Reopened" : "Resolved");
    },
    onError: () => toast.error("Couldn't update that comment."),
  });
  const setTask = (uid: string | null) => {
    const next = new URLSearchParams(sp.toString());
    uid ? next.set("task", uid) : next.delete("task");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex min-h-full w-full flex-col">
      <div role="tablist" aria-label="Assigned comments" className="flex border-b border-border bg-card">
        {([["to-me", "Assigned to me", counts?.toMe], ["by-me", "Delegated by me", counts?.byMe]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" type="button" aria-selected={mode === id} onClick={() => setMode(id)} className={cn("flex items-center gap-2 border-b-2 px-6 py-3.5 text-[14px] font-semibold", mode === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-accent/40")}>
            {label}
            {!!n && <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{n}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <label className="flex h-8 w-[260px] items-center gap-2 rounded-md border border-border bg-card px-2.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments" aria-label="Search comments" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
        <span className="flex-1" />
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          Resolved <Switch checked={showResolved} onCheckedChange={setShowResolved} aria-label="Show resolved" />
        </label>
      </div>

      <div className="px-6 pb-8">
        {isLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : rows.length === 0 && chatRows.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-primary"><CheckCircle2 className="h-6 w-6" /></span>
            <p className="font-serif text-[22px]">{term ? "Nothing matches" : mode === "to-me" ? "No comments waiting on you" : "You haven't delegated any comments"}</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">Assign a comment from the comment box in a task (the person icon) to turn it into an action item.</p>
          </div>
        ) : (
          <>
          {rows.length > 0 && <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {rows.map((c: any) => (
              <li key={c.id} className={cn("group flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 hover:bg-accent/30", c.resolvedAt && "bg-muted/25")}>
                {c.resolvedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[#b08d57]" />}
                <button type="button" onClick={() => setTask(c.task.uid)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <span className="truncate">{c.task.list.name}</span><span className="opacity-50">/</span>
                    <span className="truncate font-medium text-foreground">{c.task.name}</span>
                  </span>
                  <span className={cn("mt-1 line-clamp-2 block text-[14px]", c.resolvedAt && "text-muted-foreground line-through decoration-muted-foreground/40")}>{c.content}</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Avatar user={c.user} size={16} /> {c.user.id === user?.id ? "You" : userName(c.user)}
                    <ArrowRight className="h-3 w-3" />
                    <Avatar user={c.assignee} size={16} /> {c.assignee.id === user?.id ? "You" : userName(c.assignee)}
                    <span className="opacity-50">·</span> {when(c.createdAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggle.mutate(c)}
                  className={cn("flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-semibold", c.resolvedAt ? "text-muted-foreground hover:bg-muted" : "bg-primary/10 text-primary hover:bg-primary/15")}
                >
                  {c.resolvedAt ? <><RotateCcw className="h-3.5 w-3.5" /> Reopen</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</>}
                </button>
              </li>
            ))}
          </ul>}
          {mode === "to-me" && chatRows.length > 0 && (
            <section aria-label="Assigned in chat" className="mt-5">
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-muted-foreground"><MessageSquare className="h-4 w-4" /> From Chat <span className="font-mono text-[11px]">{chatRows.length}</span></h2>
              <ul className="overflow-hidden rounded-xl border border-border bg-card">
                {chatRows.map((m) => (
                  <li key={m.id} className={cn("flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 hover:bg-accent/30", m.resolvedAt && "bg-muted/25")}>
                    {m.resolvedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[#b08d57]" />}
                    <Link href={`/work/${workspaceId}/chat/${m.channel?.uid}?${m.parentId ? `thread=${m.parentId}&` : ""}message=${m.id}`} className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-muted-foreground">{m.channel?.kind === "channel" ? `#${m.channel?.name}` : "Direct message"}</span>
                      <span className={cn("mt-1 line-clamp-2 block text-[14px]", m.resolvedAt && "text-muted-foreground line-through")}>{m.content}</span>
                      <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Avatar user={m.user} size={16} /> {userName(m.user)} <span className="opacity-50">·</span> {when(m.createdAt)}</span>
                    </Link>
                    <button type="button" onClick={() => resolveChat.mutate(m)} className={cn("flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[12.5px] font-semibold", m.resolvedAt ? "text-muted-foreground hover:bg-muted" : "bg-primary/10 text-primary hover:bg-primary/15")}>
                      {m.resolvedAt ? <><RotateCcw className="h-3.5 w-3.5" /> Reopen</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </>
        )}
      </div>

      <TaskDrawer taskUid={taskUid} onClose={() => setTask(null)} onOpenTask={(uid) => setTask(uid)} />
    </div>
  );
}

export default function AssignedCommentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}>
      <AssignedCommentsInner />
    </Suspense>
  );
}
