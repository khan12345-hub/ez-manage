"use client";

/*
 * Executive Hub → an Accounts & Invoices team chat, embedded: messages (live), the
 * Message / Task / Many tasks composer and the Chat work panel. The same chat the members see in
 * their Accounts & Invoices workspace; sending goes through the normal chat socket.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, ListTodo, Lock, PanelRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { getMessages, markRead, type ChatMessage } from "@/services/chat.api";
import { getSocket, sendChatMessage } from "@/components/Chat/ChatProvider";
import { boardsChatKeys, parseChatWork, type BChatTask } from "@/services/chat-work.api";
import { Avatar } from "../../work/_components/primitives";
import { usePanelPref } from "../../work/_components/chat/ChatTasks";
import { BoardsChatWorkPanel, BoardsTaskCard, BoardsTaskComposer, ComposeTabs, NoteLine, ResolvedLine, useBoardsChatTasks } from "../../workspace/[workspaceId]/chat/BoardsChatWork";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** chat HTML → plain text with line breaks (shown as text, nothing from it runs) */
const toText = (h: string) =>
  h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function BoardsChannelEmbed({ ws, ch, title, isDm, onOpenTask }: { ws: number; ch: number; title: string; isDm?: boolean; onOpenTask: (t: BChatTask) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["boards", "embed-messages", ch] as const;
  const { data: msgs = [], isLoading } = useQuery({ queryKey: key, queryFn: () => getMessages(ws, ch), staleTime: 10_000 });
  const { data: tasks } = useBoardsChatTasks(ws, ch);
  const openCount = (tasks?.tasks ?? []).filter((t) => !t.done).length;
  const [mode, setMode] = useState<"message" | "task" | "bulk">("message");
  const [text, setText] = useState("");
  const [panel, setPanel] = useState(true);
  const [prefOpen, setPrefOpen] = usePanelPref("ez.boardsChatWorkPanel");
  const showPanel = panel && prefOpen;
  const bottom = useRef<HTMLDivElement>(null);

  // live: join the channel room and append new messages
  useEffect(() => {
    markRead(ws, ch).catch(() => {});
    const s = getSocket();
    s?.emit("channel:join", { channelId: ch });
    const onNew = (m: ChatMessage) => {
      if (m.channelId !== ch || m.parentId) return;
      qc.setQueryData<ChatMessage[]>(key, (old) => (old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m]));
      if (parseChatWork(m.content)) qc.invalidateQueries({ queryKey: boardsChatKeys.tasks(ch) });
    };
    s?.on("message:new", onNew);
    return () => { s?.off("message:new", onNew); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, ch]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const list = useMemo(() => msgs.filter((m) => !m.parentId), [msgs]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    sendChatMessage({ channelId: ch, content: `<p>${esc(t).replace(/\n/g, "<br>")}</p>` });
    setText("");
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-5 py-3">
          {isDm ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
          <span className="rounded bg-product-boards/12 px-1.5 py-px text-[10px] font-semibold uppercase text-product-boards dark:text-[#a5b4fc]">accounts</span>
          <button type="button" aria-pressed={showPanel} onClick={() => { const v = !showPanel; setPanel(v); setPrefOpen(v); }}
            className={cn("flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium", showPanel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
            <PanelRight className="h-3.5 w-3.5" /> Tasks {openCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{openCount}</span>}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {isLoading && [0, 1, 2].map((i) => <div key={i} className="mb-3 h-12 animate-pulse rounded-xl bg-muted" />)}
          {!isLoading && !list.length && <p className="py-16 text-center text-[13px] text-muted-foreground">No messages yet. Say hello, or give out work with the Task tab.</p>}
          {list.map((m, i) => {
            const prev = list[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const w = parseChatWork(m.content);
            const who = m.userId === user?.id ? "You" : m.user.firstName;
            return (
              <div key={m.id}>
                {newDay && <div className="my-3 flex items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />{day(m.createdAt)}<span className="h-px flex-1 bg-border" /></div>}
                {w?.kind === "note" ? <NoteLine who={who} text={w.text} /> : w?.kind === "resolved" ? <ResolvedLine who={who} name={w.name} done={w.done} at={m.createdAt} /> : (
                  <div className="flex gap-3 py-1.5">
                    <Avatar user={{ ...m.user, email: "" } as any} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]"><span className="font-semibold">{m.user.firstName} {m.user.lastName}</span> <span className="text-[11px] text-muted-foreground">{time(m.createdAt)}</span></p>
                      {w?.kind === "tasks" ? <BoardsTaskCard ws={ws} ch={ch} ids={w.taskIds} onOpen={onOpenTask} />
                        : m.content?.startsWith("__TASK__:") ? <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-primary"><ListTodo className="h-3.5 w-3.5" /> created a task</p>
                        : m.callType ? <p className="text-[13px] text-muted-foreground">{m.callType === "video" ? "Video" : "Voice"} call</p>
                        : <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{toText(m.content ?? "") || (m.attachmentUrl ? "📎 Attachment" : "")}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
        <div className="border-t border-border px-4 pb-4 pt-1">
          <ComposeTabs mode={mode} onMode={setMode} />
          {mode !== "message" ? (
            <div className="rounded-xl border border-border bg-card"><BoardsTaskComposer key={`${ch}-${mode}`} ws={ws} ch={ch} mode={mode} me={user?.id} onCreated={() => setMode("message")} /></div>
          ) : (
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-primary/40">
              <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1} placeholder={`Message ${isDm ? title : `#${title}`}`} aria-label="Message" className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13.5px] outline-none" />
              <button type="button" onClick={send} disabled={!text.trim()} aria-label="Send" className="flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground"><Send className="h-3.5 w-3.5" /> Send</button>
            </div>
          )}
        </div>
      </div>
      {showPanel && <BoardsChatWorkPanel ws={ws} ch={ch} me={user?.id} onClose={() => { setPanel(false); setPrefOpen(false); }} onOpen={onOpenTask} className="hidden lg:flex" />}
    </div>
  );
}
