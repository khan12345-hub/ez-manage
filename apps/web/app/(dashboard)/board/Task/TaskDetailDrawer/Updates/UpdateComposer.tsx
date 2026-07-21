"use client";

import {
  AtSign,
  Paperclip,
  Smile,
  Sparkles,
} from "lucide-react";

import { useState } from "react";

import {
  Button,
} from "@/components/ui/button";

import { RichTextEditor } from "./RichTextEditor/RichTextEditor";

import {
  extractMentionedUserIds,
} from "./RichTextEditor/editor-utils";

interface UpdateComposerProps {
  taskId: number;
}

export function UpdateComposer({
  taskId,
}: UpdateComposerProps) {
  const [content, setContent] =
    useState("");

  const [editorJson, setEditorJson] =
    useState<any>(null);

  const handleSubmit = () => {
    const plainText =
      editorJson?.content
        ?.map((node: any) =>
          node.content
            ?.map((item: any) =>
              item.text ?? "",
            )
            .join(""),
        )
        .join("")
        .trim() ?? "";

    if (!plainText) {
      return;
    }

    const mentionedUserIds =
      editorJson
        ? extractMentionedUserIds(
            editorJson,
          )
        : [];

    console.log({
      taskId,
      content,
      mentionedUserIds,
    });

    setContent("");
    setEditorJson(null);
  };

  return (
    <div className="border-b p-4">
      <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto gap-1 p-0 hover:bg-transparent hover:text-foreground"
        >
          <AtSign className="h-4 w-4" />

          Mention
        </Button>

        <span>|</span>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 hover:bg-transparent hover:text-foreground"
        >
          Give feedback
        </Button>
      </div>

      <RichTextEditor
        value={content}
        onChange={(html) => {
          setContent(html);
        }}
      />

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <AtSign className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Smile className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!content}
        >
          Post
        </Button>
      </div>
    </div>
  );
}