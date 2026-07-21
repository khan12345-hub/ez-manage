"use client";

import {
  AtSign,
  Paperclip,
  Smile,
  Sparkles,
} from "lucide-react";

import { useState } from "react";

interface UpdateComposerProps {
  taskId: number;
  boardId: number;
}

export function UpdateComposer({
  taskId,
  boardId,
}: UpdateComposerProps) {
  const [value, setValue] =
    useState("");

  const handleSubmit = () => {
    const content = value.trim();

    if (!content) {
      return;
    }

    console.log({
      taskId,
      boardId,
      content,
    });

    setValue("");
  };

  return (
    <div className="border-b p-4">
      {/* Optional actions */}
      <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
        >
          <AtSign className="h-4 w-4" />
          Mention
        </button>

        <span>|</span>

        <button
          type="button"
          className="hover:text-foreground"
        >
          Give feedback
        </button>
      </div>

      <div className="rounded-lg border focus-within:border-primary">
        <textarea
          value={value}
          onChange={(e) =>
            setValue(e.target.value)
          }
          placeholder="Write an update and mention others with @"
          className="min-h-[100px] w-full resize-none border-0 bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-3 text-muted-foreground">
            <button
              type="button"
              className="hover:text-foreground"
            >
              <AtSign className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="hover:text-foreground"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="hover:text-foreground"
            >
              <Smile className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="hover:text-foreground"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}