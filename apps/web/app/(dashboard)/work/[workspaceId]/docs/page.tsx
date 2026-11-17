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
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span>
          <h1 className="flex-1 text-[17px] font-semibold">Docs</h1>
          {canCreate && <button type="button" onClick={() => create.mutate(undefined)} aria-label="New page" title="New page" className="rounded-md p-1.5 hover:bg-accent"><FilePlus2 className="h-4 w-4" /></button>}
        </div>
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

function DocEditor({ uid, ws, onSubPage, onOpen, onArchived }: { uid: string; ws: string; onSubPage: (parentId: number) => void; onOpen: (uid: string) => void; onArchived: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: doc, isError, refetch } = useQuery({ queryKey: ["work", "doc", uid], queryFn: async () => (await api.get<Doc>(`/work/docs/${uid}`)).data, refetchOnWindowFocus: false });
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"saved" | "saving" | "unsaved">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: string; live?: boolean }>({});
  const save = useMutation({
    mutationFn: async (dto: { title?: string; content?: string; live?: boolean }) => (await api.patch(`/work/docs/${uid}`, dto)).data,
    onMutate: () => setState("saving"),
    onSuccess: () => { setState("saved"); qc.invalidateQueries({ queryKey: ["work", "docs", ws] }); },
    onError: (e) => { setState("unsaved"); toast.error(errMsg(e, "Couldn't save.")); },
  });
  const queue = (dto: { title?: string; content?: string; live?: boolean }) => {
    pending.current = { ...pending.current, ...dto };
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { const d = pending.current; pending.current = {}; save.mutate(d); }, 800);
  };
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); const d = pending.current; if (d.title !== undefined || d.content !== undefined) void api.patch(`/work/docs/${uid}`, d); } }, [uid]);

  // live co-editing: join the page, then the editor works on the shared copy
  const me = useMemo<CollabUser | null>(() => (user?.id ? { id: user.id, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Someone", color: colorFor(user.id), avatarUrl: user.avatarUrl ?? null } : null), [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [gen, setGen] = useState(0);
  const [live, setLive] = useState<{ room: LiveRoom; seed: boolean } | null | "static">(null);
  useEffect(() => {
    if (!doc?.id || !me) return;
    const room = new LiveRoom("docs", uid, me);
    let off = false;
    room.onReset = () => { void refetch().then(() => setGen((g) => g + 1)); };
    room.start().then((r) => { if (!off) setLive(r.live ? { room, seed: r.seed } : "static"); }).catch(() => { if (!off) setLive("static"); });
    return () => { off = true; setLive(null); void room.destroy(); };
  }, [doc?.id, me, uid, gen]); // eslint-disable-line react-hooks/exhaustive-deps
  const room = live && live !== "static" ? live.room : null;
  const peers = usePeers(room);
  // the live copy is shown in the editor a moment after it's created; fill / seed only after that
  const [rendered, setRendered] = useState<LiveRoom | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: true, autolink: true }, ...(room ? { undoRedo: false } : {}) }),
      Placeholder.configure({ placeholder: "Write something… (use the toolbar for headings, lists, checklists and tables)" }),
      TaskList, TaskItem.configure({ nested: true }), Highlight, TableKit.configure({ table: { resizable: false } }),
      ...(room && me ? [
        Collaboration.configure({ document: room.ydoc, onFirstRender: () => setRendered(room) }),
        CollaborationCaret.configure({
          provider: room, user: me,
          render: (u: Record<string, any>) => {
            const caret = document.createElement("span");
            caret.className = "collab-caret";
            caret.setAttribute("style", `position:relative;margin-left:-1px;margin-right:-1px;border-left:2px solid ${u.color};word-break:normal;pointer-events:none`);
            const label = document.createElement("span");
            label.setAttribute("style", `position:absolute;top:-1.35em;left:-2px;font-size:11px;font-weight:600;line-height:1;white-space:nowrap;color:#fff;background:${u.color};padding:2px 4px;border-radius:4px 4px 4px 0;user-select:none`);
            label.textContent = u.name;
            caret.appendChild(label);
            return caret;
          },
        }),
      ] : []),
    ],
    content: "",
    editable: false,
    // other people's changes arrive through the live copy; only this person's typing saves the HTML copy
    onUpdate: ({ editor, transaction }) => { if ((transaction.getMeta(ySyncPluginKey) as any)?.isChangeOrigin) return; queue({ content: editor.getHTML(), ...(room ? { live: true } : {}) }); },
  }, [room]);
  useEffect(() => {
    if (!doc || !editor || live === null) return;
    if (live !== "static" && rendered !== live.room) return;
    setTitle((live !== "static" && live.room.ydoc.getMap<string>("meta").get("title")) || doc.title);
    if (live === "static") editor.commands.setContent(doc.content || "", { emitUpdate: false });
    else if (live.seed) { if (!live.room.ydoc.getMap<string>("meta").get("title")) live.room.ydoc.getMap<string>("meta").set("title", doc.title); editor.commands.setContent(doc.content || "", { emitUpdate: false }); void live.room.seedDone().catch(() => toast.error("Couldn't start live editing.")); }
    editor.setEditable(doc.canEdit);
  }, [doc?.id, editor, live, rendered]); // eslint-disable-line react-hooks/exhaustive-deps
  // the title is shared live too
  useEffect(() => {
    if (!room) return;
    const meta = room.ydoc.getMap<string>("meta");
    const t = meta.get("title");
    if (typeof t === "string") setTitle(t);
    const on = (e: { transaction: { local: boolean } }) => { const v = meta.get("title"); if (!e.transaction.local && typeof v === "string") setTitle(v); };
    meta.observe(on);
    return () => meta.unobserve(on);
  }, [room]);
  const onTitle = (v: string) => { setTitle(v); queue({ title: v }); room?.ydoc.getMap<string>("meta").set("title", v); };
  const archive = useMutation({ mutationFn: () => api.delete(`/work/docs/${uid}`), onSuccess: () => { toast.success("Page archived"); onArchived(); } });

  if (isError) return <p className="py-24 text-center text-muted-foreground">This page isn&apos;t available.</p>;
  if (!doc || live === null) return <div className="m-8 h-64 animate-pulse rounded-xl bg-muted" />;
  return (
    <article className="mx-auto max-w-[860px] px-8 py-6">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {doc.parent && <><button type="button" onClick={() => onOpen(doc.parent!.uid)} className="hover:underline">{doc.parent.title}</button><ChevronRight className="h-3 w-3" /></>}
        <PeersBar peers={peers} meId={me?.id} />
        <span className="flex-1">{state === "saving" ? "Saving…" : state === "unsaved" ? "Unsaved changes" : `Saved · ${doc.updatedBy ? `${doc.updatedBy.firstName} ` : ""}${ago(doc.updatedAt)}`}</span>
        {doc.canEdit && <>
          <button type="button" onClick={() => onSubPage(doc.id)} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent"><FilePlus2 className="h-3.5 w-3.5" /> Sub-page</button>
          <button type="button" onClick={() => window.confirm(`Archive "${doc.title}"${doc.children.length ? " and its sub-pages" : ""}?`) && archive.mutate()} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent hover:text-destructive"><Archive className="h-3.5 w-3.5" /> Archive</button>
        </>}
      </div>
      <input aria-label="Page title" value={title} readOnly={!doc.canEdit} onChange={(e) => onTitle(e.target.value)} placeholder="Untitled"
        className="mb-3 w-full bg-transparent text-[32px] font-bold leading-tight outline-none placeholder:text-muted-foreground/50" />
      {doc.canEdit && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} aria-label="Page content"
        className="min-h-[50vh] text-[15px] leading-relaxed [&_.ProseMirror]:min-h-[50vh] [&_.ProseMirror]:outline-none [&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-[26px] [&_h1]:font-bold [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-[17px] [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-1 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:gap-2 [&_li[data-checked=true]>div]:text-muted-foreground [&_li[data-checked=true]>div]:line-through [&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_a]:text-primary [&_a]:underline [&_mark]:rounded [&_mark]:bg-[#fde68a] [&_mark]:px-0.5 dark:[&_mark]:bg-[#854d0e] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground/60 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]" />
      {doc.children.length > 0 && (
        <section aria-label="Sub-pages" className="mt-8 border-t border-border pt-4">
          <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">Sub-pages</h2>
          <ul className="grid gap-2 sm:grid-cols-2">{doc.children.map((c) => <li key={c.id}><button type="button" onClick={() => onOpen(c.uid)} className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-accent"><FileText className="h-4 w-4 text-muted-foreground" />{c.title}</button></li>)}</ul>
        </section>
      )}
    </article>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); editor.on("transaction", f); return () => { editor.off("transaction", f); }; }, [editor]);
  const B = ({ on, label, icon: Icon, run }: { on?: boolean; label: string; icon: typeof Bold; run: () => void }) => (
    <button type="button" aria-label={label} title={label} aria-pressed={!!on} onMouseDown={(e) => e.preventDefault()} onClick={run} className={cn("rounded-md p-1.5", on ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}><Icon className="h-4 w-4" /></button>
  );
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 backdrop-blur">
      <B label="Heading 1" icon={Heading1} on={editor.isActive("heading", { level: 1 })} run={() => c().toggleHeading({ level: 1 }).run()} />
      <B label="Heading 2" icon={Heading2} on={editor.isActive("heading", { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()} />
      <span className="mx-1 h-5 w-px bg-border" />
      <B label="Bold" icon={Bold} on={editor.isActive("bold")} run={() => c().toggleBold().run()} />
      <B label="Italic" icon={Italic} on={editor.isActive("italic")} run={() => c().toggleItalic().run()} />
      <B label="Strikethrough" icon={Strikethrough} on={editor.isActive("strike")} run={() => c().toggleStrike().run()} />
      <B label="Highlight" icon={Highlighter} on={editor.isActive("highlight")} run={() => c().toggleHighlight().run()} />
      <B label="Code" icon={Code} on={editor.isActive("code")} run={() => c().toggleCode().run()} />
      <span className="mx-1 h-5 w-px bg-border" />
      <B label="Bullet list" icon={List} on={editor.isActive("bulletList")} run={() => c().toggleBulletList().run()} />
      <B label="Numbered list" icon={ListOrdered} on={editor.isActive("orderedList")} run={() => c().toggleOrderedList().run()} />
      <B label="Checklist" icon={ListChecks} on={editor.isActive("taskList")} run={() => c().toggleTaskList().run()} />
      <B label="Quote" icon={Quote} on={editor.isActive("blockquote")} run={() => c().toggleBlockquote().run()} />
      <B label="Table" icon={TableIcon} run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <B label="Link" icon={Link2} on={editor.isActive("link")} run={() => { const prev = editor.getAttributes("link").href as string | undefined; const url = window.prompt("Link to", prev ?? "https://"); if (url === null) return; if (!url) c().unsetLink().run(); else if (/^https?:\/\//i.test(url)) c().extendMarkRange("link").setLink({ href: url }).run(); else toast.error("Links must start with http:// or https://"); }} />
    </div>
  );
}
