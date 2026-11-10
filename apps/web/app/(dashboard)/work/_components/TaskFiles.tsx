"use client";

/* Task files (attachments gallery + chips), web links and the Related-items panel. */

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  GitBranch,
  Globe,
  LayoutGrid,
  Link2,
  List as ListIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/resolveUrl";
import { workApi, type WorkAttachment, type WorkTaskDetail } from "@/services/work.api";
import { Avatar } from "./primitives";

const errMsg = (e: any) => e?.response?.data?.message?.toString?.() ?? "Something went wrong.";
export const attachmentsKey = (taskId: number) => ["work", "attachments", taskId] as const;
export const webLinksKey = (taskId: number) => ["work", "web-links", taskId] as const;

export const isImage = (a: WorkAttachment) => a.file.mimeType.startsWith("image/");
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE");
export const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`);

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const I = mime.startsWith("image/")
    ? FileImage
    : mime.startsWith("video/")
      ? FileVideo
      : mime.startsWith("audio/")
        ? FileAudio
        : mime.includes("sheet") || mime.includes("excel") || mime === "text/csv"
          ? FileSpreadsheet
          : mime.includes("zip")
            ? FileArchive
            : FileText;
  return <I className={className} />;
}

/** Small chip for a file inside a comment. */
export function FileChip({ a, onRemove }: { a: WorkAttachment; onRemove?: () => void }) {
  const url = resolveUrl(a.file.url);
  return (
    <span className="group inline-flex max-w-[240px] items-center gap-1.5 rounded-md border border-border bg-background py-1 pl-1 pr-2 text-[12px]">
      {isImage(a) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-7 w-7 rounded object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary"><FileIcon mime={a.file.mimeType} className="h-4 w-4" /></span>
      )}
      <a href={url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium hover:text-primary hover:underline">{a.file.fileName}</a>
      {onRemove && (
        <button type="button" aria-label={`Remove ${a.file.fileName}`} onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
      )}
    </span>
  );
}

export function useUpload(task: Pick<WorkTaskDetail, "id">, source: WorkAttachment["source"]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => workApi.uploadAttachments(task.id, files, source),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentsKey(task.id) });
      qc.invalidateQueries({ queryKey: ["work", "activity", task.id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

const SOURCE_LABEL = { comment: "Comment", description: "Description", task: null } as const;

/** Attachments section: drop zone + gallery/list of every file on the task (task, description and comments). */
export function AttachmentsSection({ task }: { task: WorkTaskDetail }) {
  const qc = useQueryClient();
  const canEdit = task.access.canEdit;
  const { data: files = [] } = useQuery({ queryKey: attachmentsKey(task.id), queryFn: () => workApi.attachments(task.id) });
  const upload = useUpload(task, "task");
  const del = useMutation({
    mutationFn: (id: number) => workApi.deleteAttachment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentsKey(task.id) });
      qc.invalidateQueries({ queryKey: ["work", "comments", task.id] });
      qc.invalidateQueries({ queryKey: ["work", "activity", task.id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const send = (list: FileList | null) => list?.length && upload.mutate(Array.from(list));

  return (
    <section className="border-b border-border px-6 py-4" aria-label="Attachments">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Attachments <span className="normal-case tracking-normal">{files.length}</span>
        </h3>
        <span className="flex-1" />
        {files.length > 0 && (
          <div className="flex rounded-md border border-border p-0.5">
            <button type="button" aria-label="Gallery view" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} className={cn("rounded p-1", layout === "grid" ? "bg-accent text-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="List view" aria-pressed={layout === "list"} onClick={() => setLayout("list")} className={cn("rounded p-1", layout === "list" ? "bg-accent text-foreground" : "text-muted-foreground")}><ListIcon className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {canEdit && (
          <button type="button" aria-label="Upload files" onClick={() => input.current?.click()} className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {canEdit && (
        <>
          <input ref={input} type="file" multiple hidden aria-label="Choose files" onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
            className={cn("flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[13px] text-muted-foreground transition-colors", drag ? "border-primary bg-primary/5 text-primary" : "border-border")}
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {upload.isPending ? "Uploading…" : <>Drop files here or <button type="button" onClick={() => input.current?.click()} className="font-medium text-foreground underline underline-offset-2">browse</button></>}
          </div>
        </>
      )}
      {!canEdit && files.length === 0 && <p className="text-xs text-muted-foreground">No files.</p>}

      {files.length > 0 && layout === "grid" && (
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {files.map((a) => {
            const url = resolveUrl(a.file.url);
            return (
              <li key={a.id} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <div className="flex h-28 items-center justify-center bg-muted/50">
                    {isImage(a) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={a.file.fileName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center gap-1 text-primary">
                        <FileIcon mime={a.file.mimeType} className="h-8 w-8" />
                        <span className="font-mono text-[10px] font-bold">{ext(a.file.fileName)}</span>
                      </span>
                    )}
                  </div>
                </a>
                <div className="flex items-center gap-1.5 px-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium" title={a.file.fileName}>{a.file.fileName}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {fmtSize(a.file.fileSize)}
                      {SOURCE_LABEL[a.source] && <> · <MessageSquare className="inline h-2.5 w-2.5" /> {SOURCE_LABEL[a.source]}</>}
                    </span>
                  </span>
                  <Avatar user={a.uploadedBy} size={18} />
                </div>
                <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
                  <a href={url} download={a.file.fileName} aria-label={`Download ${a.file.fileName}`} className="rounded-md bg-card/95 p-1 text-muted-foreground shadow-sm hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                  {canEdit && (
                    <button type="button" aria-label={`Delete ${a.file.fileName}`} onClick={() => window.confirm(`Delete "${a.file.fileName}"?`) && del.mutate(a.id)} className="rounded-md bg-card/95 p-1 text-muted-foreground shadow-sm hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {files.length > 0 && layout === "list" && (
        <ul className="mt-3 overflow-hidden rounded-lg border border-border">
          {files.map((a) => {
            const url = resolveUrl(a.file.url);
            return (
              <li key={a.id} className="group flex items-center gap-2.5 border-b border-border/70 px-3 py-2 last:border-b-0">
                <FileIcon mime={a.file.mimeType} className="h-4 w-4 shrink-0 text-primary" />
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:text-primary">{a.file.fileName}</a>
                {SOURCE_LABEL[a.source] && <span className="rounded bg-muted px-1.5 text-[10.5px] text-muted-foreground">{SOURCE_LABEL[a.source]}</span>}
                <span className="font-mono text-[11px] text-muted-foreground">{fmtSize(a.file.fileSize)}</span>
                <Avatar user={a.uploadedBy} size={18} />
                <a href={url} download={a.file.fileName} aria-label={`Download ${a.file.fileName}`} className="text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                {canEdit && (
                  <button type="button" aria-label={`Delete ${a.file.fileName}`} onClick={() => window.confirm(`Delete "${a.file.fileName}"?`) && del.mutate(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Web links on a task (References tab + "Add a link" panel). */
export function WebLinksList({ task }: { task: WorkTaskDetail }) {
  const qc = useQueryClient();
  const [grid, setGrid] = useState(true);
  const { data: links = [] } = useQuery({
    queryKey: webLinksKey(task.id),
    queryFn: () => workApi.webLinks(task.id),
    // previews of older links arrive a moment after the first load
    refetchInterval: (q) => ((q.state.data as any[] | undefined)?.some((l) => !l.previewAt) ? 2500 : false),
  });
  const del = useMutation({
    mutationFn: (id: number) => workApi.deleteWebLink(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: webLinksKey(task.id) }); qc.invalidateQueries({ queryKey: ["work", "activity", task.id] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!links.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">No links yet.</p>;
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const remove = (l: (typeof links)[number]) =>
    task.access.canEdit && (
      <button type="button" aria-label={`Remove link ${l.title ?? l.url}`} onClick={(e) => { e.preventDefault(); del.mutate(l.id); }} className="rounded-md bg-card/90 p-1 text-muted-foreground opacity-0 shadow-sm hover:text-destructive group-hover:opacity-100 focus:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  const Icon = ({ l }: { l: (typeof links)[number] }) =>
    l.iconUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={l.iconUrl} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" referrerPolicy="no-referrer" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
    ) : (
      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    );
  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-0.5">
        <button type="button" aria-label="Cards" aria-pressed={grid} onClick={() => setGrid(true)} className={cn("rounded p-1", grid ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="List" aria-pressed={!grid} onClick={() => setGrid(false)} className={cn("rounded p-1", !grid ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}><ListIcon className="h-3.5 w-3.5" /></button>
      </div>
      {grid ? (
        <ul aria-label="Link cards" className="space-y-3">
          {links.map((l) => (
            <li key={l.id} className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(11_42_31/0.05)] transition-shadow hover:shadow-md">
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="block">
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full bg-muted object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <span className="flex aspect-[3/1] w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-[#b08d57]/15">
                    {l.previewAt ? <Globe className="h-7 w-7 text-muted-foreground/60" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />}
                  </span>
                )}
                <span className="block px-3.5 py-2.5">
                  <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug group-hover:text-primary">{l.title || host(l.url)}</span>
                  {l.description && <span className="mt-0.5 line-clamp-2 block text-[12px] text-muted-foreground">{l.description}</span>}
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Icon l={l} /> <span className="truncate">{host(l.url)}</span></span>
                </span>
              </a>
              <span className="absolute right-2 top-2">{remove(l)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li key={l.id} className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted"><Icon l={l} /></span>
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium hover:text-primary">{l.title || l.url}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{host(l.url)}</span>
              </a>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              {remove(l)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Add a link to this task": paste a URL, or jump to relationships / dependencies. */
export function AddLinkPanel({ task, onRelate }: { task: WorkTaskDetail; onRelate: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const add = useMutation({
    mutationFn: () => workApi.addWebLink(task.id, /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`),
    onSuccess: () => {
      setUrl("");
      qc.invalidateQueries({ queryKey: webLinksKey(task.id) });
      qc.invalidateQueries({ queryKey: ["work", "activity", task.id] });
      toast.success("Link added");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="space-y-5 px-4 py-4">
      {task.access.canEdit && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Add a link</p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (url.trim()) add.mutate(); }}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
          >
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste URL (Figma, GitHub, Google Doc…)" aria-label="Paste URL" className="w-full bg-transparent text-[13px] outline-none" />
            <button type="submit" disabled={!url.trim() || add.isPending} className="rounded-md bg-forest px-2.5 py-1 text-[12px] font-semibold text-forest-foreground disabled:opacity-40 dark:bg-primary dark:text-primary-foreground">Add</button>
          </form>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Or relate items</p>
        <button type="button" onClick={onRelate} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"><GitBranch className="h-3.5 w-3.5" /> Task</button>
        <button type="button" onClick={onRelate} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"><Link2 className="h-3.5 w-3.5" /> Dependencies</button>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Other links</p>
        <WebLinksList task={task} />
      </div>
    </div>
  );
}
