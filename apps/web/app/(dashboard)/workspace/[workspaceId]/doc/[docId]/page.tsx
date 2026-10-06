"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";

import { getWorkspaceDoc, updateWorkspaceDoc } from "@/services/docs.api";

import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon, Code, Highlighter,
  ChevronLeft, Globe, Lock, Share2, Check,
} from "lucide-react";
import Link from "next/link";

const PRIVACY_ICONS: Record<string, React.ReactNode> = {
  MAIN:      <Globe   className="h-3.5 w-3.5" />,
  PRIVATE:   <Lock    className="h-3.5 w-3.5" />,
  SHAREABLE: <Share2  className="h-3.5 w-3.5" />,
};

function ToolbarBtn({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function DocEditorPage() {
  const params = useParams<{ workspaceId: string; docId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = Number(params.workspaceId);
  const docId = Number(params.docId);

  const [docName, setDocName] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["workspace-doc", workspaceId, docId],
    queryFn: () => getWorkspaceDoc(workspaceId, docId),
    enabled: !!(workspaceId && docId),
    staleTime: 30_000,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Type '/' for commands, or just start writing…" }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "doc-editor min-h-[60vh] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (!initializedRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await updateWorkspaceDoc(workspaceId, docId, { content: editor.getJSON() });
          setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          queryClient.invalidateQueries({ queryKey: ["workspace-docs", workspaceId] });
        } catch {}
        setSaving(false);
      }, 1500);
    },
  });

  // Seed editor content once doc loads
  useEffect(() => {
    if (!doc || !editor || initializedRef.current) return;
    setDocName(doc.name);
    if (doc.content && typeof doc.content === "object" && Object.keys(doc.content).length > 0) {
      editor.commands.setContent(doc.content);
    }
    initializedRef.current = true;
  }, [doc, editor]);

  const handleNameChange = useCallback((val: string) => {
    setDocName(val);
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    nameTimerRef.current = setTimeout(async () => {
      if (!val.trim()) return;
      try {
        await updateWorkspaceDoc(workspaceId, docId, { name: val.trim() });
        queryClient.invalidateQueries({ queryKey: ["workspace-docs", workspaceId] });
      } catch {}
    }, 800);
  }, [workspaceId, docId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading document…
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Document not found.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-3 shadow-sm">
        <Link
          href={`/workspace/${workspaceId}`}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <div className="mx-2 h-4 w-px bg-slate-200" />

        {/* Privacy badge */}
        <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {PRIVACY_ICONS[doc.privacy]}
          {doc.privacy.charAt(0) + doc.privacy.slice(1).toLowerCase()}
        </span>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
          {saving ? (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Saving…
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              Saved at {savedAt}
            </span>
          ) : null}
        </div>
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <div className="sticky top-[53px] z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-white px-6 py-2">
          <ToolbarBtn active={editor.isActive("bold")}           onClick={() => editor.chain().focus().toggleBold().run()}           title="Bold">         <Bold          className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("italic")}         onClick={() => editor.chain().focus().toggleItalic().run()}         title="Italic">       <Italic        className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("underline")}      onClick={() => editor.chain().focus().toggleUnderline().run()}      title="Underline">    <UnderlineIcon className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("strike")}         onClick={() => editor.chain().focus().toggleStrike().run()}         title="Strikethrough"><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("highlight")}      onClick={() => editor.chain().focus().toggleHighlight().run()}      title="Highlight">    <Highlighter   className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="mx-1.5 h-5 w-px bg-slate-200" />
          <ToolbarBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="mx-1.5 h-5 w-px bg-slate-200" />
          <ToolbarBtn active={editor.isActive("bulletList")}     onClick={() => editor.chain().focus().toggleBulletList().run()}     title="Bullet list">  <List          className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("orderedList")}    onClick={() => editor.chain().focus().toggleOrderedList().run()}    title="Ordered list"> <ListOrdered   className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive("taskList")}       onClick={() => editor.chain().focus().toggleTaskList().run()}       title="Task list">    <CheckSquare   className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="mx-1.5 h-5 w-px bg-slate-200" />
          <ToolbarBtn active={editor.isActive({ textAlign: "left" })}   onClick={() => editor.chain().focus().setTextAlign("left").run()}   title="Align left">   <AlignLeft    className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center"> <AlignCenter  className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={editor.isActive({ textAlign: "right" })}  onClick={() => editor.chain().focus().setTextAlign("right").run()}  title="Align right">  <AlignRight   className="h-3.5 w-3.5" /></ToolbarBtn>
          <div className="mx-1.5 h-5 w-px bg-slate-200" />
          <ToolbarBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block"><Code className="h-3.5 w-3.5" /></ToolbarBtn>
          <ToolbarBtn active={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table"><TableIcon className="h-3.5 w-3.5" /></ToolbarBtn>
        </div>
      )}

      {/* Editor area */}
      <div className="mx-auto w-full max-w-3xl px-8 py-12">
        {/* Doc title */}
        <input
          value={docName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Untitled"
          className="mb-8 w-full bg-transparent text-4xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none"
        />

        {/* TipTap editor */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
