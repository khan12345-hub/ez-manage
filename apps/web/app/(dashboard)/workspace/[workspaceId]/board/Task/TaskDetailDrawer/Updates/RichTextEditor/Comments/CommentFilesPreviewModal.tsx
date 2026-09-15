"use client";

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  File as FileIcon,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Printer,
  X,
} from "lucide-react";
import { format } from "date-fns";

export interface CommentFile {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url?: string;
  storageKey?: string;
  uploadedById?: number;
  uploadedAt?: string;
  uploadedBy?: { id?: number; firstName?: string; lastName?: string; avatarUrl?: string | null };
}

type SidePanel = "gallery" | "info" | null;

interface Props {
  files: CommentFile[];
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function CommentFilesPreviewModal({ files, activeIndex, onClose, onNavigate }: Props) {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const file = files[activeIndex];

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < files.length - 1;

  const togglePanel = (p: SidePanel) => setSidePanel((c) => (c === p ? null : p));

  const fileUrl = (f: CommentFile | undefined) => {
    if (!f?.url) return null;
    return f.url.startsWith("http") ? f.url : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${f.url}`;
  };

  const handleDownload = () => {
    if (!file) return;
    const url = fileUrl(file);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canGoPrev) onNavigate(activeIndex - 1);
      if (e.key === "ArrowRight" && canGoNext) onNavigate(activeIndex + 1);
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [activeIndex, canGoPrev, canGoNext]);

  if (!file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const resolvedUrl = fileUrl(file);
  const sidebarOpen = sidePanel !== null;

  return (
    <div className="fixed inset-0 z-[200] flex bg-background/95" role="dialog" aria-modal="true">

      {/* ── Header ── */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {isImage ? <ImageIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" title={file.fileName}>
              {file.fileName}
            </div>
            {file.uploadedAt && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {format(new Date(file.uploadedAt), "MMM d, yyyy")}
                {file.uploadedBy && ` · ${file.uploadedBy.firstName ?? ""} ${file.uploadedBy.lastName ?? ""}`.trim()}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Main image area ── */}
      <div
        className={`absolute bottom-20 left-0 top-16 flex items-center justify-center transition-all duration-200 ${
          sidebarOpen ? "right-[392px]" : "right-[72px]"
        }`}
        style={{ paddingLeft: "4rem", paddingRight: "4rem" }}
      >
        {resolvedUrl && isImage ? (
          <img
            src={resolvedUrl}
            alt={file.fileName}
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <FileIcon className="h-20 w-20" />
            <p className="text-sm">{file.fileName}</p>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Download to view
            </button>
          </div>
        )}
      </div>

      {/* ── Prev arrow ── */}
      <button
        type="button"
        disabled={!canGoPrev}
        onClick={() => onNavigate(activeIndex - 1)}
        className="absolute left-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      {/* ── Next arrow ── */}
      <button
        type="button"
        disabled={!canGoNext}
        onClick={() => onNavigate(activeIndex + 1)}
        className={`absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20 ${
          sidebarOpen ? "right-[412px]" : "right-[88px]"
        }`}
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* ── Side panel content ── */}
      {sidebarOpen && (
        <div className="absolute bottom-0 right-[72px] top-16 z-20 flex w-[320px] flex-col border-l bg-background">
          {sidePanel === "info" && <InfoPanel file={file} />}
          {sidePanel === "gallery" && (
            <GalleryPanel files={files} activeIndex={activeIndex} onSelect={onNavigate} />
          )}
        </div>
      )}

      {/* ── Icon strip ── */}
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
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-md border bg-background px-2 py-1.5 shadow-lg">
        <ToolBtn icon={<Expand className="h-4 w-4" />} label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()} />
        <Divider />
        <ToolBtn icon={<Download className="h-4 w-4" />} label="Download" onClick={handleDownload} />
        <ToolBtn icon={<Printer className="h-4 w-4" />} label="Print" onClick={() => window.print()} />
      </div>

      {/* ── Counter ── */}
      {files.length > 1 && (
        <div className="absolute bottom-5 left-5 z-30 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
          {activeIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}

/* ── Info panel ── */
function InfoPanel({ file }: { file: CommentFile }) {
  const ext = file.fileName.includes(".")
    ? file.fileName.slice(file.fileName.lastIndexOf(".") + 1).toUpperCase()
    : (file.mimeType ?? "—").toUpperCase();

  const formatBytes = (bytes: number) => {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const uploaderName = file.uploadedBy
    ? `${file.uploadedBy.firstName ?? ""} ${file.uploadedBy.lastName ?? ""}`.trim() || "—"
    : "—";

  return (
    <div className="flex flex-col overflow-y-auto p-4">
      <h3 className="mb-4 text-sm font-semibold">File information</h3>
      <div className="space-y-3">
        <InfoRow label="Name" value={file.fileName} />
        <InfoRow label="Type" value={ext} />
        <InfoRow label="Size" value={formatBytes(file.fileSize)} />
        <InfoRow label="Uploaded by" value={uploaderName} />
        {file.uploadedAt && (
          <InfoRow label="Upload date" value={format(new Date(file.uploadedAt), "MMM d, yyyy")} />
        )}
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

/* ── Gallery panel ── */
function GalleryPanel({
  files,
  activeIndex,
  onSelect,
}: {
  files: CommentFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const resolveUrl = (f: CommentFile) => {
    if (!f.url) return null;
    return f.url.startsWith("http") ? f.url : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${f.url}`;
  };

  return (
    <div className="flex flex-col overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Gallery ({files.length})</h3>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f, i) => {
          const isImg = f.mimeType?.startsWith("image/");
          const url = resolveUrl(f);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                i === activeIndex
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/40"
              }`}
            >
              {isImg && url ? (
                <img src={url} alt={f.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-muted text-muted-foreground">
                  <FileIcon className="h-5 w-5" />
                  <span className="mt-1 text-[8px] uppercase">
                    {f.fileName.split(".").pop() ?? f.mimeType}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Side button ── */
function SideBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
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

/* ── Toolbar button ── */
function ToolBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
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

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border" />;
}
