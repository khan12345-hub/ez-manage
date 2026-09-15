"use client";

import {
  AlertCircle,
  File as FileIcon,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import ExcelIcon from "@/components/ui/icons/ExcelIcon";
import PdfIcon from "@/components/ui/icons/PdfIcon";

import { FileUploadModal } from "./FileUploadModal";
import { CellFileGalleryModal } from "./Previews/CellFileGalleryModal";
import { FilePreviewModal } from "./Previews/FilePreviewModal";

export interface FileItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url?: string;
  uploadedById: number;
}

function isPendingImport(file: FileItem): boolean {
  const sk = file?.storageKey;
  if (!sk) return false;
  return sk.startsWith("http://") || sk.startsWith("https://");
}

function isImportFailed(file: FileItem): boolean {
  return file?.storageKey?.startsWith("import-failed:") ?? false;
}

interface FileCellProps {
  value?: {
    files: FileItem[];
    cellId?: number;
    taskId?: number;
    columnId?: number;
  } | null;
}

const MAX_VISIBLE = 3;

export function FileCell({ value }: FileCellProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [failedOpen, setFailedOpen] = useState(false);

  const queryClient = useQueryClient();

  const files = value?.files ?? [];
  const pendingFiles = files.filter(isPendingImport);
  const failedFiles = files.filter(isImportFailed);
  const readyFiles = files.filter(
    (f) => !isPendingImport(f) && !isImportFailed(f),
  );
  const hasPending = pendingFiles.length > 0;

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "board",
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasPending, queryClient]);

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const visibleFiles = readyFiles.slice(0, MAX_VISIBLE);
  const hiddenCount = readyFiles.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1 p-1">
      {/* ── File thumbnails ── */}
      {visibleFiles.map((file, i) => (
        <button
          key={file.id}
          type="button"
          onClick={() => openGallery(i)}
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted transition-opacity hover:opacity-75"
          title={file.fileName}
        >
          <MiniThumbnail file={file} />
        </button>
      ))}

      {/* ── +N more ── */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => openGallery(MAX_VISIBLE)}
          className="flex h-8 min-w-[28px] shrink-0 items-center justify-center rounded border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70"
        >
          +{hiddenCount}
        </button>
      )}

      {/* ── Pending badge ── */}
      {hasPending && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          {pendingFiles.length}
        </span>
      )}

      {/* ── Failed badge — clickable to manage failed files ── */}
      {failedFiles.length > 0 && (
        <button
          type="button"
          onClick={() => setFailedOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
          title="Click to manage failed imports"
        >
          <AlertCircle className="h-2.5 w-2.5" />
          {failedFiles.length} failed
        </button>
      )}

      {/* ── Upload button ── */}
      {(() => {
        const canUpload =
          value?.cellId != null ||
          (value?.taskId != null && value?.columnId != null);

        if (!canUpload) return null;

        return readyFiles.length === 0 && !hasPending ? (
          /* Empty state — wider dashed prompt */
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex h-8 items-center gap-1 rounded border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
        ) : (
          /* Has files — small "+" icon */
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground hover:bg-muted/70"
            title="Upload files"
          >
            <Plus className="h-3 w-3" />
          </button>
        );
      })()}

      {/* ── Gallery modal ── */}
      {galleryOpen && readyFiles.length > 0 && (
        <CellFileGalleryModal
          files={readyFiles}
          selectedIndex={galleryIndex}
          onSelectIndex={setGalleryIndex}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          onUploadClick={() => setUploadOpen(true)}
        />
      )}

      {/* ── Failed-files modal ── */}
      {failedOpen && (
        <FilePreviewModal
          open={failedOpen}
          onOpenChange={setFailedOpen}
          files={failedFiles}
          cellId={value?.cellId}
          type="CELL"
          onUploadClick={() => {
            setFailedOpen(false);
            setUploadOpen(true);
          }}
        />
      )}

      {/* ── Upload modal ── */}
      {uploadOpen && (
        <FileUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          cellId={value?.cellId}
          taskId={value?.taskId}
          columnId={value?.columnId}
          onUploadSuccess={() => setUploadOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Mini thumbnail rendered inside each cell chip ── */
function MiniThumbnail({ file }: { file: FileItem }) {
  const lowerName = file.fileName?.toLowerCase() ?? "";

  const isImage =
    file.mimeType?.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(lowerName);

  const isPdf =
    file.mimeType === "application/pdf" || lowerName.endsWith(".pdf");

  const isExcel =
    file.mimeType?.includes("spreadsheet") ||
    file.mimeType?.includes("excel") ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls");

  if (isImage && file.url) {
    const src = file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`;

    return (
      <img
        src={src}
        alt={file.fileName}
        className="h-full w-full object-cover"
      />
    );
  }

  if (isPdf) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-red-50 dark:bg-red-950/20">
        <PdfIcon size={18} />
      </div>
    );
  }

  if (isExcel) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-green-50 dark:bg-green-950/20">
        <ExcelIcon size={18} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <FileIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
