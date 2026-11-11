"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bookmark, Globe, LayoutGrid, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { workApi, type ChannelBookmark } from "@/services/work.api";
import { useChatEvents } from "./useChat";

export const bookmarksKey = (uid: string) => ["work", "chat-bookmarks", uid] as const;
const err = (e: any) => toast.error(e?.response?.data?.message?.toString?.() ?? "Something went wrong.");

export function useBookmarks(uid: string) {
  const qc = useQueryClient();
  useChatEvents((e) => { if (e.type === "bookmarks" && e.channelUid === uid) qc.invalidateQueries({ queryKey: bookmarksKey(uid) }); });
  return useQuery({ queryKey: bookmarksKey(uid), queryFn: () => workApi.channelBookmarks(uid), enabled: !!uid });
}

/** row of pinned links under the channel header (ClickUp "Bookmarks") */
export function BookmarksBar({ uid, canEdit, onAdd }: { uid: string; canEdit: boolean; onAdd: () => void }) {
  const qc = useQueryClient();
  const { data = [] } = useBookmarks(uid);
  const [editing, setEditing] = useState<ChannelBookmark | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: bookmarksKey(uid) });
  const remove = useMutation({ mutationFn: (id: number) => workApi.deleteBookmark(id), onSuccess: () => { refresh(); toast.success("Bookmark removed"); }, onError: err });
  const reorder = useMutation({ mutationFn: (ids: number[]) => workApi.reorderBookmarks(uid, ids), onSuccess: (rows) => qc.setQueryData(bookmarksKey(uid), rows), onError: err });
  const move = (i: number, d: -1 | 1) => { const ids = data.map((b) => b.id); const [x] = ids.splice(i, 1); ids.splice(i + d, 0, x!); reorder.mutate(ids); };
  if (!data.length) return null;
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-card px-4 py-1.5">
      <Bookmark className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <ul aria-label="Bookmarks" className="flex items-center gap-1">
        {data.map((b, i) => {
          const internal = b.url.startsWith("/work/");
          const Icon = internal ? LayoutGrid : Globe;
          const cls = "flex max-w-[220px] items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-foreground/85 hover:bg-accent hover:text-foreground";
          return (
            <li key={b.id} className="group flex items-center">
              {internal ? (
                <Link href={b.url} title={b.url} className={cls}><Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{b.title}</span></Link>
              ) : (
                <a href={b.url} target="_blank" rel="noopener noreferrer" title={b.url} className={cls}><Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{b.title}</span></a>
              )}
              {canEdit && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`${b.title} bookmark options`} className="invisible rounded p-0.5 text-muted-foreground hover:bg-accent group-hover:visible data-[state=open]:visible"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => setEditing(b)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                    {i > 0 && <DropdownMenuItem onClick={() => move(i, -1)}><ArrowLeft className="mr-2 h-4 w-4" /> Move left</DropdownMenuItem>}
                    {i < data.length - 1 && <DropdownMenuItem onClick={() => move(i, 1)}><ArrowRight className="mr-2 h-4 w-4" /> Move right</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => remove.mutate(b.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && <button type="button" aria-label="Add bookmark" title="Add bookmark" onClick={onAdd} className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>}
      {editing && <BookmarkDialog uid={uid} bookmark={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** add or edit a bookmark: a link and an optional title */
export function BookmarkDialog({ uid, bookmark, onClose }: { uid: string; bookmark?: ChannelBookmark; onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState(bookmark?.url ?? "");
  const [title, setTitle] = useState(bookmark?.title ?? "");
  const save = useMutation({
    mutationFn: () => (bookmark ? workApi.updateBookmark(bookmark.id, { url: url.trim(), title: title.trim() }) : workApi.addBookmark(uid, { url: url.trim(), title: title.trim() || undefined })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: bookmarksKey(uid) }); toast.success(bookmark ? "Bookmark saved" : "Bookmark added"); onClose(); },
    onError: err,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogTitle>{bookmark ? "Edit bookmark" : "Add bookmark"}</DialogTitle>
        <DialogDescription>Pin a link to the top of this channel for everyone. Web links and Work pages work.</DialogDescription>
        <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.trim() && save.mutate()} placeholder="https://… or a Work link" aria-label="Link" maxLength={2000} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.trim() && save.mutate()} placeholder="Title (optional)" aria-label="Title" maxLength={80} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-primary/50" />
        <div className="flex justify-end"><button type="button" disabled={!url.trim() || save.isPending} onClick={() => save.mutate()} className="h-9 rounded-lg bg-forest px-4 text-[13px] font-semibold text-forest-foreground disabled:opacity-50 dark:bg-primary dark:text-primary-foreground">{bookmark ? "Save" : "Add"}</button></div>
      </DialogContent>
    </Dialog>
  );
}
