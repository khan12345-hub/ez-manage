"use client";

import { useRef, useState } from "react";

import { Paperclip, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RichTextEditor } from "./RichTextEditor/RichTextEditor";

import { CommentFilePreview } from "./CommentFilePreview";

import { useCreateTaskComment } from "./useCreateComment.hooks";

interface Props {
  taskId: number;
}

export function CommentComposer({ taskId }: Props) {
  const [content, setContent] = useState("");

  const [files, setFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const createComment = useCreateTaskComment(taskId);

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    setFiles((current) => [...current, ...selectedFiles]);

    // Allows selecting
    // the same file again
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  function isContentEmpty(html: string) {
    const text = html.replace(/<[^>]*>/g, "").trim();

    return text.length === 0;
  }

  async function handleSubmit() {
    if (isContentEmpty(content) && files.length === 0) {
      return;
    }

    await createComment.mutateAsync({
      content,
      files,
    });

    setContent("");
    setFiles([]);
  }

  const isSubmitting = createComment.isPending;

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      
      <RichTextEditor
        value={content}
        onChange={setContent}
        onFilesChange={setFiles}
        placeholder="Write an update..."
      />

      <CommentFilePreview files={files} onRemove={removeFile} />

      <div className="flex items-center justify-between border-t bg-muted/30 px-2 py-1">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFiles}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={
            isSubmitting || (isContentEmpty(content) && files.length === 0)
          }
          onClick={handleSubmit}
        >
          <Send className="mr-2 h-4 w-4" />

          {isSubmitting ? "Posting..." : "Post"}
        </Button>
      </div>
    </div>
  );
}
