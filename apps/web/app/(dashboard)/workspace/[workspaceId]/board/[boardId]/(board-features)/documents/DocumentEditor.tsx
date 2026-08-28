"use client";

import { useEffect, useState } from "react";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import {
  EditorContent,
  useEditor,
} from "@tiptap/react";

import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type { BoardDocument } from "./BoardDocuments";

interface DocumentEditorProps {
  document: BoardDocument;

  onUpdate: (
    updates: Partial<BoardDocument>,
  ) => void;
}

export function DocumentEditor({
  document,
  onUpdate,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(
    document.title,
  );

  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving"
  >("saved");

  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit,

      Underline,

      TaskList,

      TaskItem.configure({
        nested: true,
      }),

      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),

      Placeholder.configure({
        placeholder:
          "Start writing... Type / for commands",
      }),

      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],

    content: document.content,

    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[600px] px-10 py-8 focus:outline-none",
      },
    },

    onUpdate: ({ editor }) => {
      setSaveStatus("saving");

      onUpdate({
        content: editor.getJSON(),
      });

      /**
       * Frontend-only save simulation.
       */
      setTimeout(() => {
        setSaveStatus("saved");
      }, 500);
    },
  });

  /**
   * Sync editor when switching documents.
   */
  useEffect(() => {
    if (!editor) return;

    setTitle(document.title);

    editor.commands.setContent(
      document.content ?? {
        type: "doc",
        content: [
          {
            type: "paragraph",
          },
        ],
      },
    );

    setSaveStatus("saved");
  }, [editor, document.id]);

  const updateTitle = (
    value: string,
  ) => {
    setTitle(value);
    setSaveStatus("saving");

    onUpdate({
      title: value,
    });

    setTimeout(() => {
      setSaveStatus("saved");
    }, 500);
  };

  const setLink = () => {
    const previousUrl =
      editor?.getAttributes("link").href ?? "";

    const url = window.prompt(
      "Enter URL",
      previousUrl,
    );

    if (url === null) return;

    if (!url.trim()) {
      editor
        ?.chain()
        .focus()
        .unsetLink()
        .run();

      return;
    }

    editor
      ?.chain()
      .focus()
      .setLink({
        href: url.trim(),
      })
      .run();
  };

  if (!editor) {
    return (
      <div className="flex h-full min-h-[600px] items-center justify-center">
        <span className="text-sm text-muted-foreground">
          Loading editor...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      {/* Document header */}
      <div className="flex items-center justify-between border-b px-8 py-4">
        <Input
          value={title}
          onChange={(event) =>
            updateTitle(event.target.value)
          }
          placeholder="Untitled document"
          className="h-auto max-w-2xl border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
              Saving
            </>
          )}

          {saveStatus === "saved" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Saved
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-background px-6 py-2">
        {/* Text formatting */}
        <ToolbarButton
          active={editor.isActive("bold")}
          tooltip="Bold"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBold()
              .run()
          }
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("italic")}
          tooltip="Italic"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleItalic()
              .run()
          }
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("underline")}
          tooltip="Underline"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleUnderline()
              .run()
          }
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("strike")}
          tooltip="Strikethrough"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleStrike()
              .run()
          }
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          tooltip="Highlight"
          onClick={() =>
            editor
              .chain()
              .focus()
            //   .toggleHighlight()
              .run()
          }
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          active={editor.isActive("heading", {
            level: 1,
          })}
          tooltip="Heading 1"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 1,
              })
              .run()
          }
        >
          H1
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", {
            level: 2,
          })}
          tooltip="Heading 2"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 2,
              })
              .run()
          }
        >
          H2
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("heading", {
            level: 3,
          })}
          tooltip="Heading 3"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleHeading({
                level: 3,
              })
              .run()
          }
        >
          H3
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          active={editor.isActive("bulletList")}
          tooltip="Bullet list"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBulletList()
              .run()
          }
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("orderedList")}
          tooltip="Numbered list"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleOrderedList()
              .run()
          }
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("taskList")}
          tooltip="Checklist"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleTaskList()
              .run()
          }
        >
          <CheckSquare className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Blocks */}
        <ToolbarButton
          active={editor.isActive("blockquote")}
          tooltip="Quote"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleBlockquote()
              .run()
          }
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive("codeBlock")}
          tooltip="Code block"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleCodeBlock()
              .run()
          }
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          tooltip="Divider"
          onClick={() =>
            editor
              .chain()
              .focus()
              .setHorizontalRule()
              .run()
          }
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          active={editor.isActive({
            textAlign: "left",
          })}
          tooltip="Align left"
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("left")
              .run()
          }
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({
            textAlign: "center",
          })}
          tooltip="Align center"
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("center")
              .run()
          }
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({
            textAlign: "right",
          })}
          tooltip="Align right"
          onClick={() =>
            editor
              .chain()
              .focus()
              .setTextAlign("right")
              .run()
          }
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          active={editor.isActive("link")}
          tooltip="Link"
          onClick={setLink}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Undo / redo */}
        <ToolbarButton
          tooltip="Undo"
          disabled={!editor.can().undo()}
          onClick={() =>
            editor
              .chain()
              .focus()
              .undo()
              .run()
          }
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          tooltip="Redo"
          disabled={!editor.can().redo()}
          onClick={() =>
            editor
              .chain()
              .focus()
              .redo()
              .run()
          }
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  active = false,
  disabled = false,
  tooltip,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md px-2 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div className="mx-1 h-5 w-px bg-border" />
  );
}

