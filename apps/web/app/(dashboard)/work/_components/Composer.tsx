"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AtSign, Loader2, Paperclip, SendHorizontal, Smile, UserCheck } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { userName, workApi, workKeys, type WorkAttachment, type WorkTaskDetail, type WorkUser } from "@/services/work.api";
import { Avatar } from "./primitives";
import { AssigneePicker } from "./pickers";
import { FileChip, attachmentsKey } from "./TaskFiles";
import { QUOTE_EVENT } from "./CommentActions";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";
const EMOJIS = ["👍", "🎉", "✅", "🔥", "👀", "🙏", "❤️", "😂", "🚀", "⚠️", "💡", "⏳"];

/** Comment composer: text, @mentions, files, assign-to, emoji. Ctrl+Enter sends. */
export function Composer({
  task,
  members,
  onPosted,
  parentId,
}: {
  task: WorkTaskDetail;
  members: WorkUser[];
  onPosted?: () => void;
  /** reply inside a thread */
  parentId?: number;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [outside, setOutside] = useState(false);
  const [files, setFiles] = useState<WorkAttachment[]>([]);
  const [mentions, setMentions] = useState<WorkUser[]>([]);
  const [assignee, setAssignee] = useState<WorkUser | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mq, setMq] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (list: File[]) => workApi.uploadAttachments(task.id, list, "comment"),
    onSuccess: (added) => {
      setFiles((f) => [...f, ...added]);
      qc.invalidateQueries({ queryKey: attachmentsKey(task.id) });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const send = useMutation({
    mutationFn: () => {
      const body = text.trim() || (files.length ? `Attached ${files.length === 1 ? "a file" : `${files.length} files`}` : "");
      const mentionIds = mentions.filter((m) => body.includes(`@${userName(m)}`)).map((m) => m.id);
      const sent = workApi.addComment(task.id, body, { parentId, assigneeId: assignee?.id, attachmentIds: files.map((f) => f.id), mentionIds });
      // "Also send outside of thread": the reply shows in the main feed too
      return parentId && outside ? sent.then((r) => workApi.addComment(task.id, body, { mentionIds }).then(() => r)) : sent;
    },
    onSuccess: () => {
      setText("");
      setFiles([]);
      setMentions([]);
      setAssignee(null);
      qc.invalidateQueries({ queryKey: workKeys.comments(task.id) });
      qc.invalidateQueries({ queryKey: attachmentsKey(task.id) });
      qc.invalidateQueries({ queryKey: workKeys.tasks(task.listId) });
      onPosted?.();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  // Quote (comment toolbar) drops "> text" into the main composer
  useEffect(() => {
    if (parentId) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ taskId: number; text: string; author: string }>).detail;
      if (d?.taskId !== task.id) return;
      const q = `${d.text.split("\n").map((l) => `> ${l}`).join("\n")}\n— ${d.author}\n\n`;
      setText((t) => q + t);
      requestAnimationFrame(() => {
        const el = area.current;
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      });
    };
    window.addEventListener(QUOTE_EVENT, on);
    return () => window.removeEventListener(QUOTE_EVENT, on);
  }, [parentId, task.id]);

  const insert = (s: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    const next = text.slice(0, at) + s + text.slice(el?.selectionEnd ?? at);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + s.length, at + s.length);
    });
  };

  const mention = (m: WorkUser) => {
    // replace a trailing "@query" the user typed, else insert at the cursor
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    const before = text.slice(0, at);
    const typed = before.match(/@([^\s@]*)$/);
    const start = typed ? at - typed[0].length : at;
    const tag = `@${userName(m)} `;
    setText(text.slice(0, start) + tag + text.slice(at));
    setMentions((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
    setMentionOpen(false);
    setMq("");
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const candidates = members.filter((m) => userName(m).toLowerCase().includes(mq.toLowerCase())).slice(0, 8);
  const canSend = (!!text.trim() || files.length > 0) && !send.isPending && !upload.isPending;

  return (
    <div
      className="rounded-xl border border-border bg-background shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) upload.mutate(Array.from(e.dataTransfer.files));
      }}
    >
      <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
        <PopoverAnchor asChild>
          <textarea
            ref={area}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              const at = e.target.selectionStart ?? v.length;
              const typed = v.slice(0, at).match(/(^|\s)@([^\s@]*)$/);
              if (typed) {
                setMq(typed[2] ?? "");
                setMentionOpen(true);
              } else if (mentionOpen) setMentionOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
                e.preventDefault();
                send.mutate();
              }
            }}
            placeholder={parentId ? "Reply… (Ctrl+Enter to send)" : "Write a comment… @ to mention, Ctrl+Enter to send"}
            aria-label={parentId ? "Reply" : "Comment"}
            rows={2}
            className="block max-h-48 min-h-[56px] w-full resize-none bg-transparent px-3 pt-2.5 text-[13.5px] outline-none [field-sizing:content]"
          />
        </PopoverAnchor>
        <PopoverContent align="start" side="top" className="w-60 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
          <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Mention</p>
          {candidates.map((m) => (
            <button key={m.id} type="button" onClick={() => mention(m)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent">
              <Avatar user={m} size={20} /> <span className="truncate">{userName(m)}</span>
            </button>
          ))}
          {candidates.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Nobody matches.</p>}
        </PopoverContent>
      </Popover>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-1.5">
          {files.map((f) => (
            <FileChip key={f.id} a={f} onRemove={() => { setFiles((x) => x.filter((y) => y.id !== f.id)); workApi.deleteAttachment(f.id).then(() => qc.invalidateQueries({ queryKey: attachmentsKey(task.id) })).catch(() => {}); }} />
          ))}
        </div>
      )}

      {parentId && (
        <label className="flex cursor-pointer items-center gap-2 px-3 pt-1 text-[12.5px] text-muted-foreground">
          <input type="checkbox" checked={outside} onChange={(e) => setOutside(e.target.checked)} className="accent-[var(--primary)]" />
          Also send outside of thread
        </label>
      )}
      <div className="flex items-center gap-0.5 px-1.5 pb-1.5 pt-1">
        <input ref={fileInput} type="file" multiple hidden aria-label="Attach files to comment" onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ""; }} />
        <ToolBtn label="Attach files" onClick={() => fileInput.current?.click()}>
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </ToolBtn>
        <ToolBtn label="Mention someone" onClick={() => { insert("@"); setMq(""); setMentionOpen(true); }}>
          <AtSign className="h-4 w-4" />
        </ToolBtn>
        <AssigneePicker
          members={members}
          value={assignee ? [assignee] : []}
          onChange={(ids) => {
            const id = ids.filter((x) => x !== assignee?.id)[0];
            setAssignee(id ? members.find((m) => m.id === id) ?? null : null);
          }}
        >
          <button type="button" title="Assign this comment" aria-label="Assign this comment" className={cn("flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px]", assignee ? "bg-[#b08d57]/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {assignee ? <><Avatar user={assignee} size={16} /> <span className="max-w-[80px] truncate">{assignee.firstName}</span></> : <UserCheck className="h-4 w-4" />}
          </button>
        </AssigneePicker>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Emoji" title="Emoji" className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Smile className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="grid w-auto grid-cols-6 gap-0.5 p-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => insert(e)} className="h-8 w-8 rounded-md text-[18px] hover:bg-accent">{e}</button>
            ))}
          </PopoverContent>
        </Popover>
        <span className="flex-1" />
        <button
          type="button"
          disabled={!canSend}
          onClick={() => send.mutate()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground hover:bg-forest/90 disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"
        >
          {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />} {parentId ? "Reply" : "Comment"}
        </button>
      </div>
    </div>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
      {children}
    </button>
  );
}
