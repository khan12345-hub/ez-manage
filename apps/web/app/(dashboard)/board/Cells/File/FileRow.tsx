"use client";

import {
  FileIcon,
  Trash2,
} from "lucide-react";

import { useState } from "react";

import {
  FilePreviewItem,
} from "./FilePreview";

import FilePreviewModal from "./FilePreviewModal";

interface FileRowProps {
  file: FilePreviewItem;
}

export default function FileRow({
  file,
}: FileRowProps) {
  const [previewOpen, setPreviewOpen] =
    useState(false);

  const isImage =
    file.mimeType?.startsWith("image/");

  const fileUrl = file.url
    ? file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`
    : null;

  const formatFileSize = (
    bytes: number,
  ) => {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const units = [
      "Bytes",
      "KB",
      "MB",
      "GB",
    ];

    const index = Math.floor(
      Math.log(bytes) / Math.log(1024),
    );

    return `${parseFloat(
      (
        bytes /
        Math.pow(1024, index)
      ).toFixed(2),
    )} ${units[index]}`;
  };

  return (
    <>
      <div className="group flex items-center gap-3 rounded-md border p-3">
        {/* Preview thumbnail */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="shrink-0"
        >
          {isImage && fileUrl ? (
            <div className="h-12 w-12 overflow-hidden rounded-md border">
              <img
                src={fileUrl}
                alt={file.fileName}
                className="h-full w-full object-cover transition-opacity hover:opacity-80"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted transition-colors hover:bg-muted/80">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </button>

        {/* File information */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium hover:underline">
            {file.fileName}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.fileSize)}
          </p>
        </button>

        {/* Delete */}
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
      />
    </>
  );
}