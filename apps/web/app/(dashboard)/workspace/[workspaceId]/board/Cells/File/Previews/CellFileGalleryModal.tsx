"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import FilePreview from "./FilePreview";
import FileThumbnail from "./FilePreviewItemThumbnail";
import { FileCommentPanel } from "./FileCommentPanel";
import type { FileItem } from "../FileCell";

interface CellFileGalleryModalProps {
  files: FileItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadClick?: () => void;
}

export function CellFileGalleryModal({
  files,
  selectedIndex,
  onSelectIndex,
  open,
  onOpenChange,
  onUploadClick,
}: CellFileGalleryModalProps) {
  const [showComments, setShowComments] = useState(false);
  const file = files[selectedIndex];
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < files.length - 1;

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "ArrowLeft" && canGoPrev) onSelectIndex(selectedIndex - 1);
      if (e.key === "ArrowRight" && canGoNext) onSelectIndex(selectedIndex + 1);
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, selectedIndex, canGoPrev, canGoNext, onOpenChange, onSelectIndex]);

  if (!open || !file) return null;

  const fileUrl = file.url
    ? file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`
    : null;

  const previewFile = {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType ?? "application/octet-stream",
    fileSize: file.fileSize,
    url: file.url,
    uploadedById: file.uploadedById,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
    >
      {/* ── Header ── */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.fileName}</p>
          {files.length > 1 && (
            <p className="text-xs text-muted-foreground">
              {selectedIndex + 1} / {files.length}
            </p>
          )}
        </div>

        {fileUrl && (
          <a
            href={fileUrl}
            download={file.fileName}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        )}

        {onUploadClick && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Upload more files"
            onClick={() => {
              onOpenChange(false);
              onUploadClick();
            }}
          >
            <Upload className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant={showComments ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          title="Toggle comments"
          onClick={() => setShowComments((v) => !v)}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Close (Esc)"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Preview + Comments split ── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Preview area */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <div className="h-full w-full overflow-auto px-16">
            <FilePreview file={previewFile} />
          </div>

          {canGoPrev && (
            <button
              type="button"
              onClick={() => onSelectIndex(selectedIndex - 1)}
              className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md transition hover:bg-background"
              title="Previous (←)"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {canGoNext && (
            <button
              type="button"
              onClick={() => onSelectIndex(selectedIndex + 1)}
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background/90 text-foreground shadow-md transition hover:bg-background"
              title="Next (→)"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Comments panel */}
        {showComments && (
          <div className="w-80 shrink-0">
            <FileCommentPanel fileId={file.id} onCollapse={() => setShowComments(false)} />
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {files.length > 1 && (
        <div className="shrink-0 border-t bg-background/95 px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {files.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectIndex(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                  i === selectedIndex
                    ? "border-primary shadow-sm"
                    : "border-transparent opacity-50 hover:opacity-90"
                }`}
                title={f.fileName}
              >
                <FileThumbnail
                  fileName={f.fileName}
                  mimeType={f.mimeType}
                  url={f.url}
                  size="sm"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
