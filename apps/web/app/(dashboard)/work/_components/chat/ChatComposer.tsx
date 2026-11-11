"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, Bold, Code, Italic, Link2, List, ListOrdered, Loader2, Paperclip, SendHorizontal, Smile, SquareCode, Strikethrough, TextQuote, Type, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { userName, workApi, type ChatFile, type ChatMessage, type WorkUser } from "@/services/work.api";
import { Avatar } from "../primitives";
import { CHAT_QUOTE_EVENT } from "./ChatMessages";
import { CHAT_REACTIONS, POST_TYPES, addOwnMessage, chatSidebarKey, threadKey, useWs } from "./useChat";

/** ClickUp chat composer: Message / Post, @mentions, files, emoji, Enter to send. */
export function ChatComposer({
  channelUid, placeholder, members, parentId, allowPost = true, initialDraft = "", onSent,
}: {
  channelUid: string; placeholder: string; members: WorkUser[]; parentId?: number; allowPost?: boolean; initialDraft?: string; onSent?: (m: ChatMessage) => void;
}) {
  const qc = useQueryClient();
  const ws = useWs();
  const [mode, setMode] = useState<"message" | "post">("message");
  const [text, setText] = useState(initialDraft);
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<string>("announcement");
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [mentions, setMentions] = useState<WorkUser[]>([]);
  const [also, setAlso] = useState(false);
  const [mOpen, setMOpen] = useState(false);
  const [fmt, setFmt] = useState(false);
  const [mq, setMq] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  useEffect(() => setText(initialDraft), [channelUid, initialDraft]);

  // save the draft a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => { workApi.chatDraft(channelUid, text, parentId).catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [text, channelUid, parentId]);

  // Quote from a message toolbar
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ channelUid: string; text: string; author: string; thread: number | null }>).detail;
      if (d.channelUid !== channelUid || (d.thread ?? undefined) !== parentId) return;
      setText((t) => `${d.text.split("\n").map((l) => `> ${l}`).join("\n")}\n— ${d.author}\n\n${t}`);
      requestAnimationFrame(() => area.current?.focus());
    };
    window.addEventListener(CHAT_QUOTE_EVENT, on);
    return () => window.removeEventListener(CHAT_QUOTE_EVENT, on);
  }, [channelUid, parentId]);

  const upload = useMutation({
    mutationFn: (list: File[]) => workApi.chatUpload(ws, list),
    onSuccess: (added) => setFiles((f) => [...f, ...added]),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Couldn't upload."),
  });
  const send = useMutation({
    mutationFn: () =>
      workApi.sendChat(channelUid, {
        content: text.trim(),
        ...(parentId ? { parentId, alsoInChannel: also } : {}),
        ...(mode === "post" ? { kind: "post" as const, title: title.trim(), postType } : {}),
        mentionIds: mentions.filter((m) => text.includes(`@${userName(m)}`)).map((m) => m.id),
        files,
      }),
    onSuccess: (m) => {
      setText(""); setTitle(""); setFiles([]); setMentions([]); setAlso(false); setMode("message");
      workApi.chatDraft(channelUid, "", parentId).catch(() => {});
      if (!parentId || m.alsoInChannel) addOwnMessage(qc, channelUid, m);
      if (parentId) qc.invalidateQueries({ queryKey: threadKey(parentId) });
      qc.invalidateQueries({ queryKey: chatSidebarKey(ws) });
      onSent?.(m);
      requestAnimationFrame(() => area.current?.focus());
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Couldn't send."),
  });

  const canSend = (!!text.trim() || files.length > 0) && (mode === "message" || !!title.trim()) && !send.isPending && !upload.isPending;
  const insert = (s: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    setText(text.slice(0, at) + s + text.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + s.length, at + s.length); });
  };
  /** wrap the selection (or a placeholder) in markup, keeping it selected */
  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = area.current;
    const a = el?.selectionStart ?? text.length;
    const b = el?.selectionEnd ?? a;
    const sel = text.slice(a, b) || placeholder;
    setText(text.slice(0, a) + before + sel + after + text.slice(b));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + before.length, a + before.length + sel.length); });
  };
  /** prefix every selected line ("- ", "1. ", "> ") */
  const lines = (make: (i: number) => string) => {
    const el = area.current;
    const a = el?.selectionStart ?? text.length;
    const b = el?.selectionEnd ?? a;
    const start = text.lastIndexOf("\n", a - 1) + 1;
    const block = text.slice(start, b) || "";
    const done = block.split("\n").map((l, i) => make(i) + l).join("\n");
    setText(text.slice(0, start) + done + text.slice(b));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + done.length, start + done.length); });
  };
  const FORMATS: { label: string; icon: typeof Bold; run: () => void; keys?: string }[] = [
    { label: "Bold", icon: Bold, run: () => wrap("**"), keys: "Ctrl+B" },
    { label: "Italic", icon: Italic, run: () => wrap("_"), keys: "Ctrl+I" },
    { label: "Strikethrough", icon: Strikethrough, run: () => wrap("~~") },
    { label: "Inline code", icon: Code, run: () => wrap("`", "`", "code") },
    { label: "Code block", icon: SquareCode, run: () => wrap("```\n", "\n```", "code") },
    { label: "Bulleted list", icon: List, run: () => lines(() => "- ") },
    { label: "Numbered list", icon: ListOrdered, run: () => lines((i) => `${i + 1}. `) },
    { label: "Quote", icon: TextQuote, run: () => lines(() => "> ") },
    { label: "Link", icon: Link2, run: () => wrap("[", "](https://)", "link text") },
  ];

  const mention = (m: WorkUser) => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    const typed = text.slice(0, at).match(/@([^\s@]*)$/);
    const start = typed ? at - typed[0].length : at;
    const tag = `@${userName(m)} `;
    setText(text.slice(0, start) + tag + text.slice(at));
    setMentions((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
    setMOpen(false);
    setMq("");
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + tag.length, start + tag.length); });
  };
  const candidates = members.filter((m) => userName(m).toLowerCase().includes(mq.toLowerCase())).slice(0, 8);
  const tool = "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div className="px-4 pb-4 pt-1">
      {allowPost && !parentId && (
        <div role="tablist" aria-label="Compose" className="mb-1 flex gap-1 text-[12.5px]">
          {(["message", "post"] as const).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={mode === x} onClick={() => setMode(x)} className={cn("rounded-md px-2 py-0.5", mode === x ? "border border-border bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {x === "message" ? "Message" : "Post"}
            </button>
          ))}
        </div>
      )}
      <div
        className="rounded-xl border border-border bg-background shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) upload.mutate(Array.from(e.dataTransfer.files)); }}
      >
        {mode === "post" && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <select aria-label="Post type" value={postType} onChange={(e) => setPostType(e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-[12px]">
              {POST_TYPES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" aria-label="Post title" maxLength={200} className="h-7 flex-1 bg-transparent text-[14px] font-semibold outline-none" />
          </div>
        )}
        {fmt && (
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1">
            {FORMATS.map((f, i) => (
              <span key={f.label} className="flex items-center">
                {(i === 4 || i === 5 || i === 8) && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
                <button type="button" aria-label={f.label} title={f.keys ? `${f.label} (${f.keys})` : f.label} onMouseDown={(e) => e.preventDefault()} onClick={f.run} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                  <f.icon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Popover open={mOpen} onOpenChange={setMOpen}>
          <PopoverAnchor asChild>
            <textarea
              ref={area}
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                const at = e.target.selectionStart ?? v.length;
                const typed = v.slice(0, at).match(/(^|\s)@([^\s@]*)$/);
                if (typed) { setMq(typed[2] ?? ""); setMOpen(true); } else if (mOpen) setMOpen(false);
                if (Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); workApi.chatTyping(channelUid).catch(() => {}); }
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "i")) {
                  e.preventDefault();
                  wrap(e.key === "b" ? "**" : "_");
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey && !mOpen) {
                  e.preventDefault();
                  if (canSend) send.mutate();
                }
              }}
              placeholder={mode === "post" ? "Write your post…" : placeholder}
              aria-label={parentId ? "Reply" : "Message"}
              rows={1}
              className="block max-h-56 min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13.5px] outline-none [field-sizing:content]"
            />
          </PopoverAnchor>
          <PopoverContent align="start" side="top" className="w-64 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
            <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Mention</p>
            {candidates.map((m) => (
              <button key={m.id} type="button" onClick={() => mention(m)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <Avatar user={m} size={20} /> <span className="truncate">{userName(m)}</span>
              </button>
            ))}
            {!candidates.length && <p className="px-2 py-2 text-xs text-muted-foreground">Nobody matches.</p>}
          </PopoverContent>
        </Popover>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-1.5">
            {files.map((f) => (
              <span key={f.id} className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[12px]">
                <Paperclip className="h-3 w-3" /> <span className="max-w-[160px] truncate">{f.name}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x.id !== f.id))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        {parentId && (
          <label className="flex cursor-pointer items-center gap-2 px-3.5 pt-1 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} className="accent-[var(--primary)]" /> Also send to channel
          </label>
        )}
        <div className="flex items-center gap-0.5 px-2 pb-1.5 pt-1">
          <input ref={fileInput} type="file" multiple hidden aria-label="Attach files" onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ""; }} />
          <button type="button" aria-label="Formatting" aria-pressed={fmt} title="Formatting" onClick={() => setFmt(!fmt)} className={cn(tool, fmt && "bg-accent text-foreground")}><Type className="h-4 w-4" /></button>
          <button type="button" aria-label="Attach files" title="Attach" onClick={() => fileInput.current?.click()} className={tool}>{upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</button>
          <button type="button" aria-label="Mention someone" title="Mention" onClick={() => { insert("@"); setMq(""); setMOpen(true); }} className={tool}><AtSign className="h-4 w-4" /></button>
          <Popover>
            <PopoverTrigger asChild><button type="button" aria-label="Emoji" title="Emoji" className={tool}><Smile className="h-4 w-4" /></button></PopoverTrigger>
            <PopoverContent align="start" side="top" className="grid w-auto grid-cols-6 gap-0.5 p-1.5">
              {CHAT_REACTIONS.map((e) => <button key={e} type="button" onClick={() => insert(e)} className="h-8 w-8 rounded-md text-[18px] hover:bg-accent">{e}</button>)}
            </PopoverContent>
          </Popover>
          <span className="flex-1" />
          <span className="mr-2 hidden text-[11px] text-muted-foreground sm:inline">Enter to send · Shift+Enter for a new line</span>
          <button type="button" aria-label={mode === "post" ? "Post" : "Send"} disabled={!canSend} onClick={() => send.mutate()} className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">
            {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />} {mode === "post" ? "Post" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
