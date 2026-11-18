"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { useAuth } from "@/providers/AuthProvider";
import { LiveRoom, PeersBar, colorFor, usePeers, type CollabUser } from "../../_components/collab";
import { Archive, Bold, ChevronRight, Code, FilePlus2, FileText, Heading1, Heading2, Highlighter, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough, Table as TableIcon, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { workApi, workKeys } from "@/services/work.api";
import { cn } from "@/lib/utils";
import { DocEditor } from "../../_components/DocEditor";
import type { WorkUser } from "@/services/work.api";

type DocRow = { id: number; uid: string; title: string; spaceId: number | null; parentId: number | null; updatedAt: string; updatedBy: WorkUser | null; preview: string };
type Doc = { id: number; uid: string; title: string; content: string; updatedAt: string; updatedBy: WorkUser | null; canEdit: boolean; children: { id: number; uid: string; title: string }[]; parent: { uid: string; title: string } | null };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const ago = (d: string) => { const m = Math.round((Date.now() - +new Date(d)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : new Date(d).toLocaleDateString([], { month: "short", day: "numeric" }); };

/** Work → Docs: pages with headings, lists, checklists, tables and links; autosaves as you type. */
export default function DocsPage() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const { data: accessTree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws, staleTime: 30_000 });
  const canCreate = !!accessTree?.access.canEdit;
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const listKey = ["work", "docs", ws];
  const { data: docs = [], isLoading } = useQuery({ queryKey: listKey, queryFn: async () => (await api.get<DocRow[]>(`/work/workspaces/${ws}/docs`)).data });
  const current = sp.get("doc") ?? docs.find((d) => !d.parentId)?.uid ?? null;
  const open = (uid: string) => router.replace(`/work/${ws}/docs?doc=${uid}`);
  const create = useMutation({
    mutationFn: async (parentId?: number) => (await api.post<{ uid: string }>(`/work/workspaces/${ws}/docs`, { title: "Untitled", ...(parentId ? { parentId } : {}) })).data,
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: listKey }); open(d.uid); },
    onError: (e) => toast.error(errMsg(e, "Couldn't create the page.")),
  });
  // tree: top-level pages with their sub-pages
  const tree = useMemo(() => {
    const kids = (pid: number | null): (DocRow & { children: any[] })[] => docs.filter((d) => d.parentId === pid).sort((a, b) => a.title.localeCompare(b.title)).map((d) => ({ ...d, children: kids(d.id) }));
    return kids(null);
  }, [docs]);
  const Node = ({ d, depth }: { d: DocRow & { children: any[] }; depth: number }) => (
    <li>
      <button type="button" onClick={() => open(d.uid)} aria-current={current === d.uid} className={cn("flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[13px]", current === d.uid ? "bg-accent font-semibold" : "hover:bg-accent/50")} style={{ paddingLeft: 8 + depth * 14 }}>
        {depth > 0 ? <ChevronRight className="h-3 w-3 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}<span className="truncate">{d.title}</span>
      </button>
      {d.children.length > 0 && <ul>{d.children.map((c) => <Node key={c.id} d={c} depth={depth + 1} />)}</ul>}
    </li>
  );

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("w-full shrink-0 overflow-y-auto border-r border-border p-3 md:block md:w-[260px]", sp.get("doc") ? "hidden" : "block")}>
        {/* same look as PageHeader, kept on one row for this narrow pane */}
        <header className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
          <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold leading-tight tracking-tight">Docs</h1>
          {canCreate && <button type="button" onClick={() => create.mutate(undefined)} aria-label="New page" title="New page" className="rounded-md p-1.5 hover:bg-accent"><FilePlus2 className="h-4 w-4" /></button>}
        </header>
        {isLoading ? <div className="h-32 animate-pulse rounded-lg bg-muted" /> : !docs.length ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-[12.5px] text-muted-foreground">No docs yet.{canCreate && <> <button type="button" onClick={() => create.mutate(undefined)} className="font-medium text-primary hover:underline">Create the first page</button>.</>}</p>
        ) : <ul aria-label="Pages">{tree.map((d) => <Node key={d.id} d={d} depth={0} />)}</ul>}
      </aside>
      <main className={cn("min-w-0 flex-1 overflow-y-auto md:block", sp.get("doc") ? "block" : "hidden")}>
        {/* phones: the page list and the editor take turns */}
        <button type="button" onClick={() => router.push(`/work/${ws}/docs`)} className="m-3 mb-0 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium md:hidden"><ChevronLeft className="h-4 w-4" /> All pages</button>
        {current ? <DocEditor key={current} uid={current} ws={ws} onSubPage={(id) => create.mutate(id)} onOpen={open} onArchived={() => { qc.invalidateQueries({ queryKey: listKey }); router.replace(`/work/${ws}/docs`); }} /> : !isLoading && <p className="py-24 text-center text-muted-foreground">Pick a page or create one.</p>}
      </main>
    </div>
  );
}
