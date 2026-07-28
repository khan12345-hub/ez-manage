"use client";

import { useEffect } from "react";

import { useEditor, EditorContent } from "@tiptap/react";

import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

import { RichTextToolbar } from "./RichTextEditorToolbar";
import { FileAttachmentPicker } from "./FileAttachmentPicker";
import { createMentionSuggestion } from "./mention-suggestion";

import { useInviteModalStore } from "@/store/invite-modal";
import Placeholder from "@tiptap/extension-placeholder";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  onFilesChange?: (files: File[]) => void;

  /**
   * Used for reply composers.
   * Makes the editor smaller and more compact.
   */
  compact?: boolean;

  /**
   * Placeholder text shown when editor is empty.
   */
  placeholder?: string;

  /**
   * Automatically focus editor when mounted.
   */
  autoFocus?: boolean;
}

export function RichTextEditor({
  value = "",
  onChange,
  onFilesChange,
  compact = false,
  placeholder = "Write an update...",
  autoFocus = false,
}: RichTextEditorProps) {
  const { boardId } = useInviteModalStore();

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus,

    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write a comment...",
      }),
      TextStyle,

      Color.configure({
        types: ["textStyle"],
      }),

      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),

      Table.configure({
        resizable: true,
      }),

      TableRow,
      TableHeader,
      TableCell,

      Mention.configure({
        HTMLAttributes: {
          class: "rounded bg-primary/10 px-1 py-0.5 font-medium text-primary",
        },

        renderText: ({ node }) => {
          return `@${node.attrs.label}`;
        },

        renderHTML: ({ options, node }) => {
          return [
            "span",
            {
              ...options.HTMLAttributes,
              "data-type": "mention",
              "data-id": node.attrs.id,
            },
            `@${node.attrs.label}`,
          ];
        },

        suggestion: createMentionSuggestion({
          boardId,
        }),
      }),
    ],

    content: value,

    editorProps: {
      attributes: {
        class: [
          compact
            ? "min-h-[60px] max-h-[180px]"
            : "min-h-[100px] max-h-[300px]",

          "overflow-y-auto",
          "px-3",
          "py-3",
          "text-sm",
          "outline-none",

          // Placeholder


          // Table
          "[&_table]:my-2",
          "[&_table]:w-full",
          "[&_table]:border-collapse",

          // Header
          "[&_th]:border",
          "[&_th]:border-border",
          "[&_th]:bg-muted/50",
          "[&_th]:px-3",
          "[&_th]:py-2",
          "[&_th]:text-left",
          "[&_th]:font-medium",

          // Cells
          "[&_td]:border",
          "[&_td]:border-border",
          "[&_td]:px-3",
          "[&_td]:py-2",
          "[&_td]:align-top",

          // Paragraphs
          "[&_td_p]:m-0",
          "[&_th_p]:m-0",

          // Selected cells
          "[&_td.is-selected]:bg-primary/10",
          "[&_th.is-selected]:bg-primary/10",

          // Column resize
          "[&_.column-resize-handle]:bg-primary",
        ].join(" "),

        "data-placeholder": placeholder,
      },
    },

    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  /**
   * Keep editor content synchronized when
   * the parent value changes.
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, {
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <EditorContent editor={editor} placeholder="Add Comment" />

      <FileAttachmentPicker onFilesChange={onFilesChange} />

      <div className="flex items-center border-t bg-muted/30 px-2 py-1">
        <RichTextToolbar editor={editor} />
      </div>
    </div>
  );
}
