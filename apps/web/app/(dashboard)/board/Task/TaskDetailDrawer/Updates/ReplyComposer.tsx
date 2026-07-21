"use client";

import { useState } from "react";

interface ReplyComposerProps {
  taskId: number;
  parentCommentId: number;
  onCancel: () => void;
}

export function ReplyComposer({
  taskId,
  parentCommentId,
  onCancel,
}: ReplyComposerProps) {
  const [value, setValue] =
    useState("");

  const handleSubmit = () => {
    const content = value.trim();

    if (!content) {
      return;
    }

    console.log({
      taskId,
      parentCommentId,
      content,
    });

    setValue("");
    onCancel();
  };

  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) =>
          setValue(e.target.value)
        }
        placeholder="Write a reply..."
        className="min-h-[70px] w-full resize-none rounded-md border p-3 text-sm outline-none focus:border-primary"
        autoFocus
      />

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Reply
        </button>
      </div>
    </div>
  );
}