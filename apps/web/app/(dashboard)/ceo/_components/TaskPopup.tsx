"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { create } from "zustand";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, CalendarDays, CheckCircle2, CornerDownRight, FileText, Mic, MessageSquare, Paperclip, SendHorizontal, Square, UserRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ceoApi, type CeoTaskDetail } from "@/services/ceo-tower.api";
import { Avatar } from "../../work/_components/primitives";
import { SourceBadge, fmtDate } from "./bits";

/** open any task (Boards or Work) in the CEO Tower popup from anywhere on the page */
export const useTaskPopup = create<{ open: { source: "boards" | "work"; id: number } | null; show: (source: "boards" | "work", id: number) => void; close: () => void }>((set) => ({
  open: null,
  show: (source, id) => set({ open: { source, id } }),
  close: () => set({ open: null }),
}));

const errMsg = (e: any, fallback: string) => e?.response?.data?.message?.toString?.() ?? fallback;
const name = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : "Someone");
/** uploaded files may be served by the API itself (relative /uploads/...) or a CDN */
const fileUrl = (u: string) => (u.startsWith("/") ? `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? ""}${u}` : u);
const when = (d: string) => new Date(d).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * CEO Tower → task popup: details, the comment thread, "Send instruction" (a comment as you),
 * change status / "Mark completed". Everything goes through Boards / Work themselves, so the
 * right people are notified and it shows in the product's own task view.
 */
export function TaskPopup() {
  const { open, close } = useTaskPopup();
  if (!open) return null;
  return <TaskPopupBody key={`${open.source}-${open.id}`} source={open.source} id={open.id} onClose={close} />;
}

function TaskPopupBody({ source, id, onClose }: { source: "boards" | "work"; id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const key = ["ceo-tower", "task", source, id];
  const { data: t, isLoading, isError, error } = useQuery({ queryKey: key, queryFn: () => ceoApi.task(source, id) });
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  // voice note: record with the microphone, attach as an audio file
  const [rec, setRec] = useState<{ mr: MediaRecorder; started: number } | null>(null);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (mr.mimeType || "audio/webm").split(";")[0]!;
        const blob = new Blob(chunks, { type });
        if (blob.size) setFiles((f) => [...f, new File([blob], `Voice note ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.${type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm"}`, { type })]);
      };
      mr.start();
      setRec({ mr, started: Date.now() });
    } catch {
      toast.error("Couldn't use the microphone. Allow it in the browser and try again.");
    }
  };
  const stopRec = () => { rec?.mr.stop(); setRec(null); };
  const refreshLists = () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "ceo-tower" && q.queryKey[1] !== "task" });
  const apply = (d: CeoTaskDetail) => { qc.setQueryData(key, d); refreshLists(); };

  const send = useMutation({
    mutationFn: () => ceoApi.taskComment(source, id, text.trim(), replyTo ?? undefined, files),
    onSuccess: (d) => { apply(d); setText(""); setReplyTo(null); setFiles([]); toast.success("Instruction sent"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't send.")),
  });
  const update = useMutation({
    mutationFn: (dto: { due?: string | null; assigneeIds?: number[]; priority?: string | null }) => ceoApi.taskUpdate(source, id, dto),
    onSuccess: (d) => { apply(d); toast.success("Task updated"); },
    onError: (e) => toast.error(errMsg(e, "Couldn't update the task.")),
  });
  const [picking, setPicking] = useState(false);
  const status = useMutation({
    mutationFn: (statusId?: number) => ceoApi.taskStatus(source, id, statusId),
    onSuccess: (d) => { apply(d); toast.success(d.done ? "Marked completed" : `Status: ${d.status?.label ?? "updated"}`); },
    onError: (e) => toast.error(errMsg(e, "Couldn't change the status.")),
  });

  const top = (t?.comments ?? []).filter((c) => !c.parentId);
  const replies = (pid: number) => (t?.comments ?? []).filter((c) => c.parentId === pid);
  const hasDone = !!t?.statuses.some((s) => s.category === "DONE");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
        {isLoading ? (
          <div className="space-y-3"><DialogTitle className="sr-only">Loading task</DialogTitle><div className="h-7 w-2/3 animate-pulse rounded bg-muted" /><div className="h-40 animate-pulse rounded-lg bg-muted" /></div>
        ) : isError || !t ? (
          <><DialogTitle className="font-serif text-[20px] font-normal">Task</DialogTitle><p role="alert" className="text-[13px] text-muted-foreground">{errMsg(error, "Couldn't open this task.")}</p></>
        ) : (
          <>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground"><SourceBadge source={t.source} /> {t.company.name} · {t.where}</p>
              <DialogTitle className={cn("mt-1 font-serif text-[23px] font-normal leading-tight", t.done && "text-muted-foreground line-through")}>{t.name}</DialogTitle>
              <DialogDescription className="sr-only">Task details, thread and actions</DialogDescription>
            </div>

            <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-border p-3.5 text-[12.5px]", t.editable.priority ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
              <div><dt className="text-[11px] text-muted-foreground">Status</dt><dd className="mt-0.5">
                {t.statuses.length ? (
                  <select aria-label="Status" value={t.status?.id ?? ""} disabled={status.isPending} onChange={(e) => e.target.value && status.mutate(Number(e.target.value))}
                    className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-[12.5px] font-semibold" style={{ color: t.status?.color }}>
                    {!t.status?.id && <option value="">{t.status?.label ?? "No status"}</option>}
                    {t.statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                ) : <span className="text-muted-foreground">{t.status?.label ?? "—"}</span>}
              </dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Due</dt><dd className="mt-0.5">
                {t.editable.due ? (
                  <input type="date" aria-label="Due date" value={t.due ?? ""} disabled={update.isPending} onChange={(e) => update.mutate({ due: e.target.value || null })}
                    className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-[12.5px]" />
                ) : <span className="mt-0.5 flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{t.due ? fmtDate(t.due) : "—"}</span>}
              </dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Assigned by</dt><dd className="mt-1 flex items-center gap-1"><UserRound className="h-3.5 w-3.5 text-muted-foreground" />{name(t.createdBy)}</dd></div>
              <div className="relative"><dt className="text-[11px] text-muted-foreground">People</dt><dd className="mt-1">
                <button type="button" onClick={() => t.editable.people && setPicking((v) => !v)} aria-label="Change people" aria-expanded={picking} className={cn("flex items-center gap-1 rounded-md", t.editable.people && "hover:bg-accent")}>
                  {t.assignees.length ? <span className="flex -space-x-1.5" title={t.assignees.map(name).join(", ")}>{t.assignees.slice(0, 5).map((a) => <Avatar key={a.id} user={a as any} size={22} />)}</span> : <span className="font-medium text-[#8a6a35] dark:text-[#d9bd8c]">Nobody</span>}
                  {t.editable.people && <span className="text-[11px] font-semibold text-primary">Change</span>}
                </button>
                {picking && (
                  <ul aria-label="Pick people" className="absolute right-0 z-10 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
                    {t.people.map((p) => { const on = t.assignees.some((a) => a.id === p.id); return (
                      <li key={p.id}><button type="button" role="checkbox" aria-checked={on} disabled={update.isPending}
                        onClick={() => update.mutate({ assigneeIds: on ? t.assignees.filter((a) => a.id !== p.id).map((a) => a.id) : [...t.assignees.map((a) => a.id), p.id] })}
                        className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12.5px] hover:bg-accent", on && "font-semibold")}><Avatar user={p as any} size={18} /><span className="flex-1 truncate">{name(p)}</span>{on && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}</button></li>
                    ); })}
                    {!t.people.length && <li className="px-2 py-1.5 text-[12px] text-muted-foreground">Nobody can be added here.</li>}
                  </ul>
                )}
              </dd></div>
              {t.editable.priority && (
                <div><dt className="text-[11px] text-muted-foreground">Priority</dt><dd className="mt-0.5">
                  <select aria-label="Priority" value={t.priority ?? ""} disabled={update.isPending} onChange={(e) => update.mutate({ priority: e.target.value || null })} className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-[12.5px]">
                    <option value="">None</option><option value="URGENT">Urgent</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option>
                  </select>
                </dd></div>
              )}
            </dl>
            {t.assignees.length > 0 && <p className="-mt-1 text-[12px] text-muted-foreground">{t.assignees.map(name).join(", ")}</p>}

            {t.description && (
              <section aria-label="Description"><h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">Scope & description</h3><p className="whitespace-pre-wrap rounded-lg bg-muted/40 px-3 py-2 text-[13px] leading-relaxed">{t.description}</p></section>
            )}

            <section aria-label="Thread">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground"><MessageSquare className="h-3.5 w-3.5" /> Thread ({t.comments.length})</h3>
              {!top.length ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">No comments yet. Your instruction will start the thread.</p> : (
                <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {top.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border p-2.5">
                      <Comment c={c} onReply={() => setReplyTo(c.id)} />
                      {replies(c.id).map((r) => <div key={r.id} className="ml-6 mt-2 border-l-2 border-border pl-2.5"><Comment c={r} /></div>)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="rounded-xl border border-border p-2.5">
              {replyTo && <p className="mb-1 flex items-center gap-1 text-[11.5px] text-muted-foreground"><CornerDownRight className="h-3 w-3" /> Replying to {name(t.comments.find((c) => c.id === replyTo)?.user)} <button type="button" onClick={() => setReplyTo(null)} className="ml-1 font-medium text-primary hover:underline">cancel</button></p>}
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={10000} aria-label="Instruction" placeholder="Send an instruction — the assignees are notified"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && (text.trim() || files.length)) send.mutate(); }}
                className="w-full resize-none bg-transparent px-1 text-[13.5px] outline-none" />
              {files.length > 0 && (
                <ul aria-label="Attached" className="mb-2 flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{f.type.startsWith("audio/") ? <Mic className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}<span className="max-w-[180px] truncate">{f.name}</span>
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-background"><X className="h-3 w-3" /></button></li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,audio/*" onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((f) => [...f, ...picked].slice(0, 5)); }} />
                  <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach a file" title="Attach a file" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
                  {rec ? (
                    <button type="button" onClick={stopRec} aria-label="Stop recording" className="flex h-8 items-center gap-1.5 rounded-md bg-destructive/10 px-2 text-[12px] font-semibold text-destructive"><Square className="h-3 w-3 fill-current" /> Stop · recording</button>
                  ) : (
                    <button type="button" onClick={startRec} aria-label="Record a voice note" title="Record a voice note" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><Mic className="h-4 w-4" /></button>
                  )}
                </span>
                <Link href={t.href} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Open in {t.source === "work" ? "Work" : "Boards"} <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                <span className="flex items-center gap-2">
                  {!t.done && hasDone && (
                    <button type="button" onClick={() => status.mutate(undefined)} disabled={status.isPending} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[12.5px] font-semibold hover:bg-accent disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Mark completed</button>
                  )}
                  <button type="button" onClick={() => send.mutate()} disabled={(!text.trim() && !files.length) || send.isPending || !!rec} className="flex h-8 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"><SendHorizontal className="h-3.5 w-3.5" /> {send.isPending ? "Sending…" : replyTo ? "Send reply" : "Send instruction"}</button>
                </span>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Comment({ c, onReply }: { c: CeoTaskDetail["comments"][number]; onReply?: () => void }) {
  return (
    <div className="flex gap-2.5">
      {c.user ? <Avatar user={c.user as any} size={24} /> : <span className="h-6 w-6 rounded-full bg-muted" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]"><strong>{name(c.user)}</strong><span className="font-mono text-[10.5px] text-muted-foreground">{when(c.createdAt)}</span>{onReply && <button type="button" onClick={onReply} className="text-[11.5px] font-medium text-primary hover:underline">Reply</button>}</p>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{c.text}</p>
        {c.files?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {c.files.map((f, i) => f.mime.startsWith("audio/") || f.mime === "video/webm" ? (
              <audio key={i} controls preload="none" src={fileUrl(f.url)} className="h-9 max-w-full" aria-label={f.name} />
            ) : f.mime.startsWith("image/") ? (
              <a key={i} href={fileUrl(f.url)} target="_blank" rel="noreferrer"><img src={fileUrl(f.url)} alt={f.name} className="h-20 rounded-md border border-border object-cover" /></a>
            ) : (
              <a key={i} href={fileUrl(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] hover:bg-accent"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{f.name}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
