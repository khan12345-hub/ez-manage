"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download,
  Info, LayoutGrid, MessageSquare, Printer, Trash2, X,
} from "lucide-react";
import { format } from "date-fns";

import { TaskFile } from "@/app/(dashboard)/workspace/[workspaceId]/board/Task/TaskDetailDrawer/Files/FileItem";
import FilePreview from "./FilePreview";
import FileThumbnail from "./FilePreviewItemThumbnail";
import { FileCommentPanel } from "./FileCommentPanel";

type SidePanel = "gallery" | "info" | "comments" | null;

interface Props {
  file: TaskFile | null;
  files: TaskFile[];
  onClose: () => void;
  onNavigate: (file: TaskFile) => void;
  onDelete?: (file: TaskFile) => void;
}

export default function SingleFilePreviewModal({ file, files, onClose, onNavigate, onDelete }: Props) {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);

  const currentIndex = file ? files.findIndex((f) => f.id === file.id) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const goPrev = () => { if (canGoPrev) onNavigate(files[currentIndex - 1]!); };
  const goNext = () => { if (canGoNext) onNavigate(files[currentIndex + 1]!); };
  const togglePanel = (p: SidePanel) => setSidePanel((cur) => (cur === p ? null : p));

  const handleDownload = () => {
    if (!file) return;
    const href = file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`;
    const a = document.createElement("a");
    a.href = href; a.download = file.fileName; a.target = "_blank";
    document.body.appendChild(a); a.click(); a.remove();
  };

  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [file, currentIndex, files]);

  if (!file) return null;

  const sidebarOpen = sidePanel !== null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95" role="dialog" aria-modal="true">

      {/* HEADER */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={file.fileName}>
            {file.fileName}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{file.source === "COMMENT" ? "Update" : (file.columnName ?? "Files")}</span>
            <span>›</span>
            <span>{format(new Date(file.uploadedAt), "MMM d, yyyy")}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div
        className={`absolute bottom-20 left-0 top-16 flex items-center justify-center overflow-hidden transition-all duration-200 ${
          sidebarOpen ? "right-[392px]" : "right-[72px]"
        }`}
        style={{ paddingLeft: "4rem", paddingRight: "4rem" }}
      >
        <FilePreview file={file} />
      </div>

      {/* NAV ARROWS */}
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={goPrev}
        title="Previous"
        className="absolute left-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        disabled={!canGoNext}
        onClick={goNext}
        title="Next"
        className={`absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20 ${
          sidebarOpen ? "right-[412px]" : "right-[88px]"
        }`}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* SIDEBAR PANEL */}
      {sidebarOpen && (
        <div className="absolute bottom-0 right-[72px] top-16 z-20 flex w-[320px] flex-col border-l bg-background overflow-y-auto">
          {sidePanel === "info" && <InfoPanel file={file} />}
          {sidePanel === "gallery" && (
            <GalleryPanel files={files} currentFile={file} onSelect={onNavigate} />
          )}
          {sidePanel === "comments" && <FileCommentPanel fileId={file.id} onCollapse={() => togglePanel("comments")} />}
        </div>
      )}

      {/* RIGHT ICON STRIP */}
      <div className="absolute right-0 top-16 z-30 flex w-[72px] flex-col items-center border-l bg-background">
        <SideBtn
          icon={<LayoutGrid className="h-5 w-5" />}
          label="Gallery"
          active={sidePanel === "gallery"}
          onClick={() => togglePanel("gallery")}
        />
        <SideBtn
          icon={<Info className="h-5 w-5" />}
          label="Info"
          active={sidePanel === "info"}
          onClick={() => togglePanel("info")}
        />
        <SideBtn
          icon={<MessageSquare className="h-5 w-5" />}
          label="Comments"
          active={sidePanel === "comments"}
          onClick={() => togglePanel("comments")}
        />
      </div>

      {/* BOTTOM TOOLBAR */}
      <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-md border bg-background px-2 py-1.5 shadow-lg">
        <ToolBtn icon={<Download className="h-4 w-4" />} label="Download" onClick={handleDownload} />
        <ToolBtn icon={<Printer className="h-4 w-4" />} label="Print" onClick={() => window.print()} />
        {onDelete && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolBtn
              icon={<Trash2 className="h-4 w-4 text-destructive" />}
              label="Delete"
              onClick={() => { onClose(); onDelete(file); }}
            />
          </>
        )}
      </div>

      {/* COUNTER */}
      {files.length > 1 && (
        <div className="absolute bottom-5 left-5 z-30 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}

/* ── Info Panel ─────────────────────────────────────────────────────── */

function InfoPanel({ file }: { file: TaskFile }) {
  const ext = file.fileName.includes(".")
    ? file.fileName.slice(file.fileName.lastIndexOf(".") + 1).toUpperCase()
    : "";
  const uploaderName = file.uploadedBy
    ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`
    : "—";

  return (
    <div className="flex flex-col p-4">
      <h3 className="mb-4 text-sm font-semibold">File information</h3>
      <div className="space-y-3">
        <InfoRow label="Name" value={file.fileName} />
        {ext && <InfoRow label="Type" value={ext} />}
        <InfoRow
          label="Source"
          value={file.source === "COMMENT" ? "Update comment" : (file.columnName ?? "Files column")}
        />
        <InfoRow label="Uploaded by" value={uploaderName} />
        <InfoRow label="Upload date" value={format(new Date(file.uploadedAt), "MMM d, yyyy")} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-all text-sm" title={value}>{value}</span>
    </div>
  );
}

/* ── Gallery Panel ──────────────────────────────────────────────────── */

function GalleryPanel({
  files,
  currentFile,
  onSelect,
}: {
  files: TaskFile[];
  currentFile: TaskFile;
  onSelect: (f: TaskFile) => void;
}) {
  return (
    <div className="flex flex-col p-4">
      <h3 className="mb-3 text-sm font-semibold">Gallery ({files.length})</h3>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => {
          const isActive = f.id === currentFile.id;
          const isImg = f.mimeType.startsWith("image/");
          const imgUrl = f.url.startsWith("http")
            ? f.url
            : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${f.url}`;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                isActive
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/40"
              }`}
            >
              {isImg ? (
                <img src={imgUrl} alt={f.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <FileThumbnail fileName={f.fileName} mimeType={f.mimeType} size="sm" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Small helpers ──────────────────────────────────────────────────── */

function SideBtn({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[72px] flex-col items-center gap-1.5 px-1 py-4 text-[11px] transition-colors ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToolBtn({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="flex h-7 min-w-7 cursor-pointer items-center justify-center rounded px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {icon}
    </button>
  );
}
