"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, File as FileIcon, FileImage, FileSpreadsheet, FileText, FileVideo, Music, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { userName, workApi, type ChatFile } from "@/services/work.api";
import { useWs } from "./useChat";

export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);
const isImage = (f: ChatFile) => f.mime?.startsWith("image/");
const isPdf = (f: ChatFile) => f.mime === "application/pdf";
function Icon({ f, className }: { f: ChatFile; className?: string }) {
  const m = f.mime ?? "";
  const I = m.startsWith("image/") ? FileImage : m.startsWith("video/") ? FileVideo : m.startsWith("audio/") ? Music : /sheet|excel|csv/.test(m) ? FileSpreadsheet : /pdf|word|document|text\//.test(m) ? FileText : FileIcon;
  return <I className={className} />;
}
const ext = (name: string) => (name.includes(".") ? name.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE");

/** full-size viewer: images (with prev / next) and PDFs */
export function FileViewer({ files, index, onClose }: { files: ChatFile[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const f = files[i]!;
  const go = (d: number) => setI((x) => (x + d + files.length) % files.length);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-[min(1100px,94vw)]" onKeyDown={(e) => { if (files.length > 1 && e.key === "ArrowRight") go(1); if (files.length > 1 && e.key === "ArrowLeft") go(-1); }}>
        <div className="flex items-center gap-2 pr-8">
          <DialogTitle className="truncate text-[14px]">{f.name}</DialogTitle>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{fmtSize(f.size)}{files.length > 1 ? ` · ${i + 1} of ${files.length}` : ""}</span>
          <a href={f.url} download={f.name} target="_blank" rel="noreferrer" className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] hover:bg-accent"><Download className="h-3.5 w-3.5" /> Download</a>
        </div>
        <DialogDescription className="sr-only">File preview</DialogDescription>
        <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-lg bg-muted/40">
          {isPdf(f) ? (
            <iframe src={f.url} title={f.name} className="h-[75vh] w-full rounded-lg bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.url} alt={f.name} className="max-h-[75vh] max-w-full object-contain" />
          )}
          {files.length > 1 && (
            <>
              <button type="button" aria-label="Previous file" onClick={() => go(-1)} className="absolute left-2 rounded-full bg-background/90 p-2 shadow hover:bg-background"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next file" onClick={() => go(1)} className="absolute right-2 rounded-full bg-background/90 p-2 shadow hover:bg-background"><ChevronRight className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** files under a message: image thumbnails, inline video / audio, cards for everything else */
export function MessageFiles({ files }: { files: ChatFile[] | undefined }) {
  const [view, setView] = useState<{ list: ChatFile[]; i: number } | null>(null);
  if (!files?.length) return null;
  const images = files.filter(isImage);
  const rest = files.filter((f) => !isImage(f));
  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 && (
        <div className={cn("grid max-w-[480px] gap-1.5", images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {images.map((f, i) => (
            <button key={f.id} type="button" aria-label={`Open ${f.name}`} onClick={() => setView({ list: images, i })} className="block overflow-hidden rounded-lg border border-border bg-muted/30 hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.name} loading="lazy" className={cn("w-full object-cover", images.length === 1 ? "max-h-72" : "h-28")} />
            </button>
          ))}
        </div>
      )}
      {rest.map((f) =>
        f.mime?.startsWith("video/") ? (
          <video key={f.id} src={f.url} controls preload="metadata" aria-label={f.name} className="max-h-72 max-w-[480px] rounded-lg border border-border bg-black" />
        ) : f.mime?.startsWith("audio/") ? (
          <div key={f.id} className="flex max-w-[480px] flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"><span className="text-[12px] text-muted-foreground">{f.name}</span><audio src={f.url} controls preload="metadata" aria-label={f.name} className="w-full" /></div>
        ) : (
          <div key={f.id} className="flex max-w-[420px] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon f={f} className="h-4.5 w-4.5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{f.name}</span>
              <span className="block font-mono text-[11px] text-muted-foreground">{ext(f.name)} · {fmtSize(f.size)}</span>
            </span>
            {isPdf(f) && <button type="button" aria-label={`Preview ${f.name}`} title="Preview" onClick={() => setView({ list: [f], i: 0 })} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Eye className="h-4 w-4" /></button>}
            <a href={f.url} download={f.name} target="_blank" rel="noreferrer" aria-label={`Download ${f.name}`} title="Download" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Download className="h-4 w-4" /></a>
          </div>
        ),
      )}
      {view && <FileViewer files={view.list} index={view.i} onClose={() => setView(null)} />}
    </div>
  );
}

const TYPES = [["all", "All"], ["images", "Images"], ["docs", "Documents"], ["media", "Media"], ["other", "Other"]] as const;

/** the channel's Files panel: everything shared, filter by type, search by name, jump to the message */
export function FilesPanel({ uid }: { uid: string }) {
  const ws = useWs();
  const [type, setType] = useState<(typeof TYPES)[number][0]>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<{ list: ChatFile[]; i: number } | null>(null);
  const res = useInfiniteQuery({
    queryKey: ["work", "chat-files", uid, type, q.trim()],
    queryFn: ({ pageParam }) => workApi.channelFiles(uid, { type: type === "all" ? undefined : type, q: q.trim() || undefined, cursor: pageParam || undefined }),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = useMemo(() => res.data?.pages.flatMap((p) => p.items) ?? [], [res.data]);
  const images = items.filter(isImage);
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <label className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5"><Search className="h-3.5 w-3.5 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a file by name" aria-label="Find a file" className="w-full bg-transparent text-[13px] outline-none" /></label>
      <div role="tablist" aria-label="File types" className="flex flex-wrap gap-1">
        {TYPES.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={type === v} onClick={() => setType(v)} className={cn("rounded-full border px-2.5 py-0.5 text-[12px]", type === v ? "border-primary/50 bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>)}
      </div>
      {res.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : !items.length ? (
        <p className="py-8 text-center text-[12.5px] text-muted-foreground">{q || type !== "all" ? "No files match." : "Files shared here show up in this list."}</p>
      ) : (
        <ul aria-label="Files" className="space-y-1.5">
          {items.map((f, k) => (
            <li key={`${f.messageId}-${f.id}-${k}`} className="flex items-center gap-2.5 rounded-lg border border-border p-2">
              {isImage(f) ? (
                <button type="button" aria-label={`Open ${f.name}`} onClick={() => setView({ list: images, i: images.indexOf(f) })} className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ) : (
                <button type="button" aria-label={isPdf(f) ? `Preview ${f.name}` : f.name} disabled={!isPdf(f)} onClick={() => setView({ list: [f], i: 0 })} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon f={f} className="h-4 w-4" /></button>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{f.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{fmtSize(f.size)} · {userName(f.user)} · {new Date(f.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                <Link href={`/work/${ws}/chat/${uid}?${f.parentId ? `thread=${f.parentId}&` : ""}message=${f.messageId}`} className="text-[11px] font-medium text-primary hover:underline">Go to message</Link>
              </span>
              <a href={f.url} download={f.name} target="_blank" rel="noreferrer" aria-label={`Download ${f.name}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
            </li>
          ))}
        </ul>
      )}
      {res.hasNextPage && <button type="button" onClick={() => res.fetchNextPage()} disabled={res.isFetchingNextPage} className="h-8 rounded-md border border-border text-[12.5px] hover:bg-accent disabled:opacity-50">{res.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
      {view && <FileViewer files={view.list} index={Math.max(0, view.i)} onClose={() => setView(null)} />}
    </div>
  );
}
