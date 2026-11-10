"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Copy, FileText, Link2, MessageSquareReply, MoreHorizontal, Pencil, Pin, PinOff, Quote, SmilePlus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { userName, workApi, type ChatMessage, type WorkUser } from "@/services/work.api";
import { Avatar } from "../primitives";
import { PersonHover } from "../people";
import { CHAT_REACTIONS, POST_TYPES, messagesKey, threadKey } from "./useChat";

export const CHAT_QUOTE_EVENT = "ez:work-chat-quote";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  const y = new Date();
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** text → links, @mentions, bullets and line breaks */
export function RichText({ text, members = [] }: { text: string; members?: WorkUser[] }) {
  const names = members.map((m) => userName(m)).filter(Boolean).sort((a, b) => b.length - a.length);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(https?:\\/\\/[^\\s<]+|\\*\\*[^*]+\\*\\*|@everyone|${names.length ? names.map((n) => `@${esc(n)}`).join("|") : "@\\u0000"})`, "g");
  const inline = (line: string, k: string) =>
    line.split(re).map((part, i) => {
      if (/^https?:\/\//.test(part)) return <a key={`${k}${i}`} href={part} target="_blank" rel="noreferrer noopener" className="break-all text-primary underline-offset-2 hover:underline">{part}</a>;
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${k}${i}`}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("@") && (part === "@everyone" || names.includes(part.slice(1)))) return <span key={`${k}${i}`} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{part}</span>;
      return <Fragment key={`${k}${i}`}>{part}</Fragment>;
    });
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: number) => {
    if (!bullets.length) return;
    out.push(<ul key={`u${k}`} className="my-0.5 list-disc space-y-0.5 pl-5">{bullets.map((b, i) => <li key={i}>{inline(b, `b${k}-${i}`)}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach((l, i) => {
    if (/^\s*[-•*]\s+/.test(l)) bullets.push(l.replace(/^\s*[-•*]\s+/, ""));
    else if (/^>\s?/.test(l)) { flush(i); out.push(<blockquote key={i} className="my-0.5 border-l-2 border-border pl-2.5 text-muted-foreground">{inline(l.replace(/^>\s?/, ""), `q${i}`)}</blockquote>); }
    else { flush(i); out.push(<span key={i} className="block min-h-[1.2em]">{inline(l, `l${i}`)}</span>); }
  });
  flush(lines.length);
  return <>{out}</>;
}

function Files({ files }: { files: ChatMessage["files"] }) {
  if (!files?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {files.map((f) =>
        f.mime?.startsWith("image/") ? (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="max-h-64 max-w-[320px] object-cover" />
          </a>
        ) : (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] hover:bg-accent">
            <FileText className="h-4 w-4 text-muted-foreground" /> <span className="max-w-[220px] truncate">{f.name}</span>
          </a>
        ),
      )}
    </div>
  );
}

/** one message (or post) row with its hover toolbar */
export function MessageRow({
  m, grouped, members, me, channelUid, onOpenThread, inThread = false,
}: {
  m: ChatMessage; grouped: boolean; members: WorkUser[]; me?: number; channelUid: string; onOpenThread?: (id: number) => void; inThread?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const refresh = (up?: ChatMessage) => {
    if (up) qc.setQueryData<{ items: ChatMessage[]; hasMore: boolean }>(messagesKey(channelUid), (old) => old && { ...old, items: old.items.map((x) => (x.id === up.id ? { ...up, mine: x.mine, saved: x.saved } : x)) });
    qc.invalidateQueries({ queryKey: threadKey(m.parentId ?? m.id) });
  };
  const react = useMutation({ mutationFn: (e: string) => workApi.reactChat(m.id, e), onSuccess: refresh, onError: () => toast.error("Couldn't react.") });
  const pin = useMutation({ mutationFn: () => workApi.pinChat(m.id, !m.pinnedAt), onSuccess: (up) => { refresh(up); qc.invalidateQueries({ queryKey: ["work", "chat-channel", channelUid] }); toast.success(m.pinnedAt ? "Unpinned" : "Pinned to the channel"); } });
  const save = useMutation({
    mutationFn: () => workApi.saveChat(m.id, !m.saved),
    onSuccess: () => {
      qc.setQueryData<{ items: ChatMessage[]; hasMore: boolean }>(messagesKey(channelUid), (old) => old && { ...old, items: old.items.map((x) => (x.id === m.id ? { ...x, saved: !m.saved } : x)) });
      qc.invalidateQueries({ queryKey: ["work", "chat-saved"] });
      toast.success(m.saved ? "Removed from Saved" : "Saved for later");
    },
  });
  const edit = useMutation({ mutationFn: () => workApi.editChat(m.id, draft.trim()), onSuccess: (up) => { setEditing(false); refresh(up); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't edit.") });
  const remove = useMutation({ mutationFn: () => workApi.deleteChat(m.id), onSuccess: () => qc.invalidateQueries({ queryKey: messagesKey(channelUid) }), onError: () => toast.error("Couldn't delete.") });
  const link = () => `${window.location.origin}${window.location.pathname}?${m.parentId ? `thread=${m.parentId}&` : ""}message=${m.id}`;

  if (m.kind === "system") {
    return (
      <li className="flex items-center gap-2 px-6 py-1 text-[12px] text-muted-foreground">
        <span className="h-px w-6 bg-border" /> <strong className="font-medium text-foreground/80">{userName(m.user)}</strong> {m.content} · {time(m.createdAt)}
      </li>
    );
  }
  const deleted = !!m.deletedAt;
  const post = m.kind === "post" ? POST_TYPES.find((p) => p.id === m.postType) ?? POST_TYPES[0] : null;
  const btn = "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <li id={`msg-${m.id}`} className={cn("group/m relative flex gap-3 px-6 hover:bg-accent/30", grouped ? "py-0.5" : "pt-2.5 pb-0.5")}>
      <span className="w-9 shrink-0">
        {!grouped ? (
          <PersonHover user={m.user}><button type="button" aria-label={`${userName(m.user)} profile`} className="rounded-full"><Avatar user={m.user} size={36} /></button></PersonHover>
        ) : (
          <span className="invisible block pt-0.5 text-right text-[10.5px] text-muted-foreground group-hover/m:visible">{time(m.createdAt)}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <PersonHover user={m.user}><button type="button" className="text-[13.5px] font-semibold hover:underline">{userName(m.user)}</button></PersonHover>
            <span className="text-[11.5px] text-muted-foreground">{time(m.createdAt)}</span>
            {m.pinnedAt && <span className="flex items-center gap-0.5 text-[11px] text-[#8a6a3a]"><Pin className="h-3 w-3" /> Pinned</span>}
            {m.alsoInChannel && !inThread && <span className="text-[11px] text-muted-foreground">replied in a thread</span>}
          </p>
        )}
        {deleted ? (
          <p className="text-[13.5px] italic text-muted-foreground">This message was deleted.</p>
        ) : editing ? (
          <div className="mt-1 rounded-lg border border-primary/40 bg-background p-2">
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) edit.mutate(); } if (e.key === "Escape") setEditing(false); }} aria-label="Edit message" className="block w-full resize-none bg-transparent text-[13.5px] outline-none [field-sizing:content]" />
            <div className="mt-1 flex justify-end gap-2 text-[12px]">
              <button type="button" onClick={() => setEditing(false)} className="rounded px-2 py-1 text-muted-foreground hover:bg-accent">Cancel</button>
              <button type="button" onClick={() => draft.trim() && edit.mutate()} className="rounded bg-forest px-2.5 py-1 font-semibold text-forest-foreground dark:bg-primary dark:text-primary-foreground">Save</button>
            </div>
          </div>
        ) : post ? (
          <div className="mt-1 max-w-[720px] rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(11_42_31/0.05)]">
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${post.color}18`, color: post.color }}>{post.label}</span>
            <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{m.title}</h3>
            <div className="mt-1 text-[13.5px] leading-relaxed"><RichText text={m.content} members={members} /></div>
            <Files files={m.files} />
          </div>
        ) : (
          <div className="text-[13.5px] leading-relaxed">
            <RichText text={m.content} members={members} />
            {m.editedAt && <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span>}
            <Files files={m.files} />
          </div>
        )}
        {!deleted && m.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {m.reactions.map((r) => (
              <button key={r.emoji} type="button" aria-pressed={!!me && r.userIds.includes(me)} aria-label={`${r.emoji} ${r.userIds.length}`} onClick={() => react.mutate(r.emoji)} className={cn("flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]", me && r.userIds.includes(me) ? "border-primary/40 bg-primary/10" : "border-border bg-background hover:bg-accent")}>
                <span>{r.emoji}</span><span className="font-medium tabular-nums">{r.userIds.length}</span>
              </button>
            ))}
          </div>
        )}
        {!inThread && m.replyCount > 0 && onOpenThread && (
          <button type="button" onClick={() => onOpenThread(m.id)} className="mt-1 flex items-center gap-1.5 rounded-md py-0.5 text-[12px] font-semibold text-primary hover:underline">
            <MessageSquareReply className="h-3.5 w-3.5" /> {m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}
            {m.lastReplyAt && <span className="font-normal text-muted-foreground">· last reply {time(m.lastReplyAt)}</span>}
          </button>
        )}
      </div>

      {!deleted && !editing && (
        <div role="toolbar" aria-label="Message actions" className="invisible absolute -top-3.5 right-6 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-md group-hover/m:visible has-[[data-state=open]]:visible">
          {["👍", "✅", "🔥"].map((e) => <button key={e} type="button" aria-label={`React ${e}`} onClick={() => react.mutate(e)} className="h-7 w-7 rounded-md text-[15px] hover:bg-accent">{e}</button>)}
          <Popover>
            <PopoverTrigger asChild><button type="button" aria-label="Add reaction" className={btn}><SmilePlus className="h-4 w-4" /></button></PopoverTrigger>
            <PopoverContent align="end" side="top" className="grid w-auto grid-cols-6 gap-0.5 p-1.5">
              {CHAT_REACTIONS.map((e) => <button key={e} type="button" aria-label={`React ${e}`} onClick={() => react.mutate(e)} className="h-8 w-8 rounded-md text-[18px] hover:bg-accent">{e}</button>)}
            </PopoverContent>
          </Popover>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {!inThread && onOpenThread && <button type="button" aria-label="Reply in thread" title="Reply in thread" onClick={() => onOpenThread(m.id)} className={btn}><MessageSquareReply className="h-4 w-4" /></button>}
          <button type="button" aria-label="Quote" title="Quote" onClick={() => window.dispatchEvent(new CustomEvent(CHAT_QUOTE_EVENT, { detail: { channelUid, text: m.content, author: userName(m.user), thread: inThread ? m.parentId : null } }))} className={btn}><Quote className="h-4 w-4" /></button>
          <button type="button" aria-label="Copy link to message" title="Copy link" onClick={() => navigator.clipboard.writeText(link()).then(() => toast.success("Link copied"))} className={btn}><Link2 className="h-4 w-4" /></button>
          <button type="button" aria-label={m.saved ? "Remove from Saved" : "Save for later"} title={m.saved ? "Saved" : "Save for later"} onClick={() => save.mutate()} className={cn(btn, m.saved && "text-[#b08d57]")}>{m.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}</button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button type="button" aria-label="More message actions" className={btn}><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => pin.mutate()}>{m.pinnedAt ? <><PinOff className="mr-2 h-4 w-4" /> Unpin</> : <><Pin className="mr-2 h-4 w-4" /> Pin to channel</>}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(m.content).then(() => toast.success("Text copied"))}><Copy className="mr-2 h-4 w-4" /> Copy text</DropdownMenuItem>
              {m.mine && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setDraft(m.content); setEditing(true); }}><Pencil className="mr-2 h-4 w-4" /> Edit message</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.confirm("Delete this message?") && remove.mutate()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete message</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}

/** the scrolling list with day dividers and author grouping */
export function MessageList({
  items, members, me, channelUid, onOpenThread, emptyText, focusId, onLoadOlder, hasMore,
}: {
  items: ChatMessage[]; members: WorkUser[]; me?: number; channelUid: string; onOpenThread?: (id: number) => void; emptyText?: React.ReactNode; focusId?: number | null; onLoadOlder?: () => void; hasMore?: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const last = items[items.length - 1]?.id;
  const atBottom = useRef(true);
  useEffect(() => {
    if (focusId) document.getElementById(`msg-${focusId}`)?.scrollIntoView({ block: "center" });
    else if (atBottom.current) end.current?.scrollIntoView({ block: "end" });
  }, [last, focusId]);
  return (
    <div ref={box} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }} className="min-h-0 flex-1 overflow-y-auto py-3">
      {hasMore && onLoadOlder && (
        <div className="py-2 text-center"><button type="button" onClick={onLoadOlder} className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground hover:bg-accent">Load older messages</button></div>
      )}
      {!hasMore && emptyText}
      <ul aria-label="Messages">
        {items.map((m, i) => {
          const prev = items[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const grouped = !newDay && !!prev && prev.user.id === m.user.id && prev.kind === "message" && m.kind === "message" && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <li aria-hidden className="sticky top-0 z-[5] flex items-center gap-3 px-6 py-2">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full border border-border bg-card px-3 py-0.5 text-[11.5px] font-medium shadow-sm">{dayLabel(m.createdAt)}</span>
                  <span className="h-px flex-1 bg-border" />
                </li>
              )}
              <MessageRow m={m} grouped={grouped} members={members} me={me} channelUid={channelUid} onOpenThread={onOpenThread} />
            </Fragment>
          );
        })}
      </ul>
      <div ref={end} />
    </div>
  );
}
