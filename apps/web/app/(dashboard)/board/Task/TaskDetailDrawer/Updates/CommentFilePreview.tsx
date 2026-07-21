"use client";

import {
  FileIcon,
  ImageIcon,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  files: File[];

  onRemove: (
    index: number,
  ) => void;
}

export function CommentFilePreview({
  files,
  onRemove,
}: Props) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="border-t px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {files.map(
          (file, index) => {
            const isImage =
              file.type.startsWith(
                "image/",
              );

            const previewUrl =
              isImage
                ? URL.createObjectURL(
                    file,
                  )
                : null;

            return (
              <div
                key={`${file.name}-${index}`}
                className="group relative overflow-hidden rounded-md border bg-muted"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-20 w-20 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-32 items-center gap-2 px-3">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />

                    <span className="max-w-20 truncate text-xs">
                      {file.name}
                    </span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1 top-1 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() =>
                    onRemove(index)
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}