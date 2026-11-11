"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CircleDashed, Forward, Hash, ListChecks, RotateCcw, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { userName, workApi, workKeys, type ChatMessage } from "@/services/work.api";
import { Avatar } from "../primitives";
import { RichText } from "./ChatMessages";
import { messagesKey, useChatSidebar, useWs } from "./useChat";

const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

/** "Create task" from a message: choose a list, the message becomes the description */
export function CreateTaskFromMessage({ m, channelUid, onClose }: { m: ChatMessage; channelUid: string; onClose: () => void }) {
  const ws = useWs();
  const qc = useQueryClient();
  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws) });
  const [q, setQ] = useState("");
  const [listId, setListId] = useState<number | null>(null);
  const [name, setName] = useState((m.title || m.content.split("\n")[0] || "").slice(0, 200));
  const lists = useMemo(() => (tree?.spaces ?? []).flatMap((s) => [...s.lists.map((l) => ({ id: l.id, name: l.name, path: s.name })), ...s.folders.flatMap((f) => f.lists.map((l) => ({ id: l.id, name: l.name, path: `${s.name} / ${f.name}` })))]), [tree]);
  const shown = lists.filter((l) => `${l.path} ${l.name}`.toLowerCase().includes(q.toLowerCase()));
  const create = useMutation({
    mutationFn: () => workApi.chatToTask(m.id, listId!, name.trim()),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: messagesKey(channelUid) });
      toast.success(`Task created: ${t.name}`, { action: { label: "Open", onClick: () => window.location.assign(`/work/${ws}/list/${t.listUid}?task=${t.uid}`) } });
      onClose();
    },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Create a task from this message</DialogTitle>
        <DialogDescription>The message goes into the task description with a link back to the chat.</DialogDescription>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Task name" maxLength={200} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] font-medium outline-none focus:border-primary/50" />
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a list" aria-label="Find a list" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <ul role="listbox" aria-label="Lists" className="max-h-56 overflow-y-auto rounded-lg border border-border p-1">
          {shown.map((l) => (
            <li key={l.id}>
              <button type="button" role="option" aria-selected={listId === l.id} onClick={() => setListId(l.id)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", listId === l.id && "bg-primary/10 font-medium")}>
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" /> <span className="flex-1 truncate">{l.name}</span> <span className="truncate text-[11px] text-muted-foreground">{l.path}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-2 py-3 text-[12.5px] text-muted-foreground">No list matches.</li>}
        </ul>
        <div className="flex justify-end">
          <button type="button" disabled={!listId || !name.trim() || create.isPending} onClick={() => create.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">Create task</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** forward a message to another channel or DM */
export function ForwardMessage({ m, onClose }: { m: ChatMessage; onClose: () => void }) {
  const { user } = useAuth();
  const { data = [] } = useChatSidebar();
  const [q, setQ] = useState("");
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const label = (c: (typeof data)[number]) => (c.kind === "channel" ? `#${c.name}` : c.people.length ? c.people.map((p) => userName(p)).join(", ") : `${user?.firstName ?? "You"} (you)`);
  const targets = data.filter((c) => (c.kind !== "channel" || c.joined) && label(c).toLowerCase().includes(q.toLowerCase()));
  const send = useMutation({ mutationFn: () => workApi.chatForward(m.id, to!, note.trim() || undefined), onSuccess: () => { toast.success("Message forwarded"); onClose(); }, onError: err });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogTitle>Forward message</DialogTitle>
        <DialogDescription className="line-clamp-2">“{m.content || m.title}”</DialogDescription>
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channel or person" aria-label="Find a conversation" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <ul role="listbox" aria-label="Conversations" className="max-h-52 overflow-y-auto rounded-lg border border-border p-1">
          {targets.map((c) => (
            <li key={c.uid}>
              <button type="button" role="option" aria-selected={to === c.uid} onClick={() => setTo(c.uid)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent", to === c.uid && "bg-primary/10 font-medium")}>
                {c.kind === "channel" ? <Hash className="h-3.5 w-3.5 text-muted-foreground" /> : c.people.length === 1 ? <Avatar user={c.people[0]!} size={18} /> : <Users className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="truncate">{label(c)}</span>
              </button>
            </li>
          ))}
        </ul>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" aria-label="Note" rows={2} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary/50" />
        <div className="flex justify-end">
          <button type="button" disabled={!to || send.isPending} onClick={() => send.mutate()} className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><Forward className="h-3.5 w-3.5" /> Forward</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** extras shown under a message: forwarded card, task chip, assignment bar */
export function MessageExtras({ m, me, channelUid, members }: { m: ChatMessage; me?: number; channelUid: string; members: Parameters<typeof RichText>[0]["members"] }) {
  const ws = useWs();
  const qc = useQueryClient();
  const resolve = useMutation({ mutationFn: (v: boolean) => workApi.chatResolve(m.id, v), onSuccess: () => { qc.invalidateQueries({ queryKey: messagesKey(channelUid) }); qc.invalidateQueries({ queryKey: ["work", "chat-assigned"] }); }, onError: err });
  return (
    <>
      {m.forwarded && (
        <div className="mt-1 max-w-[640px] rounded-lg border-l-4 border-primary/40 bg-muted/40 px-3 py-2">
          <p className="text-[11.5px] text-muted-foreground">Forwarded from {m.forwarded.channelName ? `#${m.forwarded.channelName}` : "a direct message"} · <strong className="text-foreground/80">{m.forwarded.authorName}</strong></p>
          {m.forwarded.title && <p className="mt-0.5 text-[13.5px] font-semibold">{m.forwarded.title}</p>}
          <div className="mt-0.5 text-[13px]"><RichText text={m.forwarded.content} members={members} /></div>
          <Link href={`/work/${ws}/chat/${m.forwarded.channelUid}?message=${m.forwarded.messageId}`} className="mt-1 inline-block text-[11.5px] font-medium text-primary hover:underline">View original</Link>
        </div>
      )}
      {m.task && (
        <Link href={`/work/${ws}/list/${m.task.list.uid}?task=${m.task.uid}`} className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[12px] hover:bg-accent">
          <ListChecks className={cn("h-3.5 w-3.5", m.task.completedAt ? "text-primary" : "text-muted-foreground")} /> <span className="text-muted-foreground">Task:</span> <span className={cn("truncate font-medium", m.task.completedAt && "line-through")}>{m.task.name}</span>
        </Link>
      )}
      {m.assignee && (
        <div className={cn("mt-1.5 flex max-w-[640px] items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px]", m.resolvedAt ? "border-border" : "border-[#b08d57]/60 bg-[#b08d57]/5")}>
          {m.resolvedAt ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <CircleDashed className="h-3.5 w-3.5 text-[#b08d57]" />}
          <span className="text-muted-foreground">{m.resolvedAt ? "Resolved" : "Assigned to"} <strong className="text-foreground">{m.assignee.id === me ? "you" : userName(m.assignee)}</strong></span>
          {(m.assignee.id === me || m.mine) && (
            <button type="button" onClick={() => resolve.mutate(!m.resolvedAt)} className={cn("ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold", m.resolvedAt ? "text-muted-foreground hover:bg-muted" : "bg-primary/10 text-primary hover:bg-primary/15")}>
              {m.resolvedAt ? <><RotateCcw className="h-3 w-3" /> Reopen</> : <><CheckCircle2 className="h-3 w-3" /> Resolve</>}
            </button>
          )}
        </div>
      )}
    </>
  );
}
