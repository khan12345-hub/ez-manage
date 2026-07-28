
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "../RichTextEditor";

interface CommentEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function CommentEditor({
  initialContent = "",
  onSave,
  onCancel,
}: CommentEditorProps) {
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    if (!content.trim()) return;

    onSave(content);
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Replace this with your existing rich text editor */}
      <RichTextEditor
        value={content}
        onChange={setContent}
      />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!content.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

