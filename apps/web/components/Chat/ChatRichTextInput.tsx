"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered } from "lucide-react";

export interface ChatRichTextInputHandle {
  getHTML: () => string;
  getText: () => string;
  clearContent: () => void;
  appendText: (text: string) => void;
  /** Replace trailing @<query> with @name in the editor */
  insertMention: (name: string, query: string) => void;
  focus: () => void;
}

interface Props {
  placeholder: string;
  channelId: number | null;
  onUpdate: (html: string, text: string) => void;
  onSend: () => void;
}

const DRAFT_KEY = (id: number) => `chat_draft_${id}`;

const ChatRichTextInput = forwardRef<ChatRichTextInputHandle, Props>(
  ({ placeholder, channelId, onUpdate, onSend }, ref) => {
    // Keep callback refs stable — avoids stale-closure bugs in editorProps
    const onSendRef = useRef(onSend);
    const onUpdateRef = useRef(onUpdate);
    useEffect(() => { onSendRef.current = onSend; }, [onSend]);
    useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

    const channelIdRef = useRef(channelId);
    useEffect(() => { channelIdRef.current = channelId; }, [channelId]);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          horizontalRule: false,
          blockquote: false,
        }),
        Placeholder.configure({ placeholder }),
      ],
      editorProps: {
        attributes: { class: "tiptap-chat-editor" },
        handleKeyDown(_view, event) {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSendRef.current();
            return true;
          }
          return false;
        },
      },
      onUpdate({ editor }) {
        const html = editor.getHTML();
        const text = editor.getText();
        onUpdateRef.current(html, text);
        const cid = channelIdRef.current;
        if (cid) {
          text.trim()
            ? localStorage.setItem(DRAFT_KEY(cid), html)
            : localStorage.removeItem(DRAFT_KEY(cid));
        }
      },
    });

    // Load per-channel draft whenever channelId changes
    useEffect(() => {
      if (!editor || channelId === null) return;
      const draft = localStorage.getItem(DRAFT_KEY(channelId));
      editor.commands.setContent(draft ?? "");
      // setContent triggers onUpdate which syncs input state
    }, [editor, channelId]);

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      clearContent: () => {
        editor?.commands.clearContent(true);
        const cid = channelIdRef.current;
        if (cid) localStorage.removeItem(DRAFT_KEY(cid));
      },
      appendText: (text) => {
        editor?.chain().focus().insertContent(text).run();
      },
      insertMention: (name, query) => {
        if (!editor) return;
        const { state } = editor;
        const { from } = state.selection;
        const textBefore = state.doc.textBetween(0, from);
        // Find the @query we're replacing
        const needle = `@${query}`;
        const atIdx = textBefore.lastIndexOf(needle);
        if (atIdx !== -1) {
          editor.chain().focus()
            .deleteRange({ from: atIdx, to: from })
            .insertContent(`@${name} `)
            .run();
        } else {
          editor.chain().focus().insertContent(`@${name} `).run();
        }
      },
      focus: () => editor?.commands.focus(),
    }), [editor]);

    return (
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact formatting toolbar */}
        <div className="mb-1 flex items-center gap-0.5">
          <ToolBtn
            active={!!editor?.isActive("bold")}
            title="Bold (Ctrl+B)"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3 w-3" />
          </ToolBtn>
          <ToolBtn
            active={!!editor?.isActive("italic")}
            title="Italic (Ctrl+I)"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3 w-3" />
          </ToolBtn>
          <ToolBtn
            active={!!editor?.isActive("strike")}
            title="Strikethrough"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-3 w-3" />
          </ToolBtn>
          <ToolBtn
            active={!!editor?.isActive("code")}
            title="Inline code"
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <Code className="h-3 w-3" />
          </ToolBtn>
          <span className="mx-1 h-3 w-px shrink-0 bg-border" />
          <ToolBtn
            active={!!editor?.isActive("bulletList")}
            title="Bullet list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3 w-3" />
          </ToolBtn>
          <ToolBtn
            active={!!editor?.isActive("orderedList")}
            title="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3 w-3" />
          </ToolBtn>
        </div>

        <EditorContent editor={editor} />
      </div>
    );
  },
);

ChatRichTextInput.displayName = "ChatRichTextInput";

function ToolBtn({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      // onMouseDown prevents the editor from losing focus
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded p-1 transition-colors ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default ChatRichTextInput;
