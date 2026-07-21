"use client";

import {
  EditorContent,
  useEditor,
} from "@tiptap/react";

import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";

import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

import { RichTextToolbar } from "./RichTextToolbar";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
}

export function RichTextEditor({
  value = "",
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,

    extensions: [
      StarterKit,

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
          class:
            "rounded bg-primary/10 px-1 py-0.5 font-medium text-primary",
        },

        suggestion: {
          char: "@",

          items: ({ query }) => {
            // Replace this with API search
            return [];
          },
        },
      }),
    ],

    content: value,

    editorProps: {
      attributes: {
        class:
          "min-h-[100px] max-h-[300px] overflow-y-auto px-3 py-3 text-sm outline-none",
      },
    },

    onUpdate: ({ editor }) => {
      onChange?.(
        editor.getHTML(),
      );
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <EditorContent
        editor={editor}
      />

      <div className="border-t bg-muted/30 px-2 py-1">
        <RichTextToolbar
          editor={editor}
        />
      </div>
    </div>
  );
}