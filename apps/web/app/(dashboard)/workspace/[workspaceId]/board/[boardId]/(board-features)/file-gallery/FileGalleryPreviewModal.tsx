"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileIcon,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Loader2,
  Printer,
  Trash2,
  X,
} from "lucide-react";

import { BoardGalleryFile } from "@/services/boards.api";

type SidePanel = "gallery" | "info" | null;

interface FilePreviewModalProps {
  file: BoardGalleryFile | null;
  files: BoardGalleryFile[];
  onClose: () => void;
  onNavigate: (file: BoardGalleryFile) => void;
  onDelete: (file: BoardGalleryFile) => void;
}

export function FilePreviewModal({
  file,
  files,
  onClose,
  onNavigate,
  onDelete,
}: FilePreviewModalProps) {
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);

  const currentIndex = file ? files.findIndex((f) => f.id === file.id) : -1;
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const goPrevious = () => {
    if (!canGoPrevious) return;
    const prev = files[currentIndex - 1];
    if (prev) onNavigate(prev);
  };

  const goNext = () => {
    if (!canGoNext) return;
    const next = files[currentIndex + 1];
    if (next) onNavigate(next);
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((current) => (current === panel ? null : panel));
  };

  const handleDownload = () => {
    if (!file) return;
    const link = document.createElement("a");
    link.href = process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url;
    link.download = file.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /* Keyboard navigation */
  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrevious();
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

  const isImage = file.type === "image";
  const sidebarOpen = sidePanel !== null;

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-background/95"
      role="dialog"
      aria-modal="true"
    >
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {isImage ? <ImageIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {file.boardName && <><span>{file.boardName}</span><span>›</span></>}
              {file.taskName && <><span>{file.taskName}</span><span>›</span></>}
              <span>{formatDate(file.updatedAt)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ================================================== */}

      <div
        className={`absolute bottom-20 left-0 top-16 flex items-center justify-center transition-all duration-200 ${
          sidebarOpen ? "right-[392px]" : "right-[72px]"
        }`}
        style={{ paddingLeft: "4rem", paddingRight: "4rem" }}
      >
        <FileViewer file={file} onDownload={handleDownload} />
      </div>

      {/* ================================================== */}
      {/* NAVIGATION ARROWS */}
      {/* ================================================== */}

      <button
        type="button"
        disabled={!canGoPrevious}
        onClick={goPrevious}
        className="absolute left-5 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20"
        title="Previous"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>

      <button
        type="button"
        disabled={!canGoNext}
        onClick={goNext}
        className={`absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20 ${
          sidebarOpen ? "right-[412px]" : "right-[88px]"
        }`}
        title="Next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* ================================================== */}
      {/* RIGHT SIDE PANEL */}
      {/* ================================================== */}

      {sidebarOpen && (
        <div className="absolute bottom-0 right-[72px] top-16 z-20 flex w-[320px] flex-col border-l bg-background">
          {sidePanel === "info" && <InfoPanel file={file} />}
          {sidePanel === "gallery" && (
            <GalleryPanel
              files={files}
              currentFile={file}
              onSelect={onNavigate}
            />
          )}
        </div>
      )}

      {/* ================================================== */}
      {/* RIGHT ICON STRIP */}
      {/* ================================================== */}

      <div className="absolute right-0 top-16 z-30 flex w-[72px] flex-col items-center border-l bg-background">
        <SideButton
          icon={<LayoutGrid className="h-5 w-5" />}
          label="Gallery"
          active={sidePanel === "gallery"}
          onClick={() => togglePanel("gallery")}
        />
        <SideButton
          icon={<Info className="h-5 w-5" />}
          label="Info"
          active={sidePanel === "info"}
          onClick={() => togglePanel("info")}
        />
      </div>

      {/* ================================================== */}
      {/* BOTTOM TOOLBAR */}
      {/* ================================================== */}

      <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-md border bg-background px-2 py-1.5 shadow-lg">
        <ToolbarButton
          icon={<Expand className="h-4 w-4" />}
          label="Fullscreen"
          onClick={() => document.documentElement.requestFullscreen?.()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<Download className="h-4 w-4" />}
          label="Download"
          onClick={handleDownload}
        />

        <ToolbarButton
          icon={<Printer className="h-4 w-4" />}
          label="Print"
          onClick={() => window.print()}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          label="Delete"
          onClick={() => {
            onClose();
            onDelete(file);
          }}
        />
      </div>

      {/* Counter */}
      {files.length > 1 && (
        <div className="absolute bottom-5 left-5 z-30 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}

/* ================================================== */
/* DOCX VIEWER — mammoth converts .docx → HTML       */
/* ================================================== */

function DocxViewer({ src, onDownload }: { src: string; onDownload: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setHtml(null); setError(false);
    // dynamic import so mammoth is only loaded when needed
    import("mammoth/mammoth.browser")
      .then((mammoth) =>
        fetch(src)
          .then((r) => r.arrayBuffer())
          .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
          .then((result) => setHtml(result.value))
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [src]);

  if (loading) return <ViewerLoader label="Loading document…" />;
  if (error || !html) return <DownloadFallback type="document" onDownload={onDownload} />;

  return (
    <div className="h-full w-full overflow-auto rounded-lg border bg-white shadow-inner">
      <div
        className="prose prose-sm max-w-none p-10 text-gray-800 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:p-1.5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ================================================== */
/* XLSX VIEWER — SheetJS renders Excel as HTML table */
/* ================================================== */

function XlsxViewer({ src, onDownload }: { src: string; onDownload: () => void }) {
  const [sheets, setSheets] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [htmlMap, setHtmlMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setSheets([]); setHtmlMap({}); setActiveIdx(0); setError(false);
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array" });
        const map: Record<string, string> = {};
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          map[name] = XLSX.utils.sheet_to_html(ws ?? {}, { editable: false });
        });
        setSheets(wb.SheetNames);
        setHtmlMap(map);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [src]);

  if (loading) return <ViewerLoader label="Loading spreadsheet…" />;
  if (error || sheets.length === 0) return <DownloadFallback type="excel" onDownload={onDownload} />;

  const activeSheet = sheets[activeIdx] ?? "";
  const activeHtml = htmlMap[activeSheet] ?? "";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white shadow-inner">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b bg-muted/40 px-2 pt-2">
          {sheets.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`rounded-t-md border px-4 py-1.5 text-xs font-medium transition-colors ${
                i === activeIdx
                  ? "border-b-white bg-white text-primary"
                  : "border-transparent text-muted-foreground hover:bg-background"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div
          className="excel-preview min-w-max p-2"
          dangerouslySetInnerHTML={{ __html: activeHtml }}
        />
      </div>
    </div>
  );
}

/* ================================================== */
/* SHARED HELPERS                                     */
/* ================================================== */

function ViewerLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function DownloadFallback({ type, onDownload }: { type: string; onDownload: () => void }) {
  const typeColors: Record<string, string> = {
    document: "text-blue-700",
    excel: "text-emerald-600",
    archive: "text-amber-500",
  };
  return (
    <div className={`flex flex-col items-center gap-4 ${typeColors[type] ?? "text-muted-foreground"}`}>
      <FileIcon className="h-20 w-20" />
      <p className="text-xs text-muted-foreground uppercase">{type}</p>
      <button
        type="button"
        onClick={onDownload}
        className="mt-2 flex items-center gap-2 rounded-md border px-4 py-2 text-sm text-foreground hover:bg-muted"
      >
        <Download className="h-4 w-4" />
        Download to view
      </button>
    </div>
  );
}

/* ================================================== */
/* FILE VIEWER — inline PDF, video, audio, image     */
/* ================================================== */

function FileViewer({
  file,
  onDownload,
}: {
  file: BoardGalleryFile;
  onDownload: () => void;
}) {
  const src = process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url;

  if (file.type === "image") {
    return (
      <img
        src={src}
        alt={file.name}
        className="max-h-full max-w-full select-none object-contain"
        draggable={false}
      />
    );
  }

  if (file.type === "pdf") {
    return (
      <iframe
        src={src}
        title={file.name}
        className="h-full w-full rounded border-0"
        style={{ minHeight: "calc(100vh - 140px)" }}
      />
    );
  }

  if (file.type === "video") {
    return (
      <video
        src={src}
        controls
        className="max-h-full max-w-full rounded"
        style={{ maxHeight: "calc(100vh - 140px)" }}
      >
        Your browser does not support video playback.
      </video>
    );
  }

  if (file.type === "audio") {
    return (
      <div className="flex flex-col items-center gap-6 text-muted-foreground">
        <FileIcon className="h-20 w-20 text-green-500" />
        <p className="max-w-xs truncate text-sm font-medium text-foreground">{file.name}</p>
        <audio src={src} controls className="w-full max-w-md">
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }

  if (file.type === "document") {
    return <DocxViewer src={src} onDownload={onDownload} />;
  }

  if (file.type === "excel") {
    return <XlsxViewer src={src} onDownload={onDownload} />;
  }

  /* Fallback: archive, unknown */
  return <DownloadFallback type={file.type} onDownload={onDownload} />;
}

/* ================================================== */
/* INFO PANEL */
/* ================================================== */

function InfoPanel({ file }: { file: BoardGalleryFile }) {
  const ext = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase()
    : file.type.toUpperCase();

  return (
    <div className="flex flex-col overflow-y-auto p-4">
      <h3 className="mb-4 text-sm font-semibold">File information</h3>

      <div className="space-y-3">
        <InfoRow label="Name" value={file.name} />
        <InfoRow label="Type" value={ext} />
        <InfoRow label="Board" value={file.boardName} />
        <InfoRow label="Task" value={file.taskName} />
        <InfoRow label="Upload date" value={formatDate(file.updatedAt)} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-all text-sm" title={value}>
        {value}
      </span>
    </div>
  );
}

/* ================================================== */
/* GALLERY PANEL */
/* ================================================== */

function GalleryPanel({
  files,
  currentFile,
  onSelect,
}: {
  files: BoardGalleryFile[];
  currentFile: BoardGalleryFile;
  onSelect: (file: BoardGalleryFile) => void;
}) {
  return (
    <div className="flex flex-col overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">
        Gallery ({files.length})
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => {
          const isImage = f.type === "image";
          const isActive = f.id === currentFile.id;
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
              {isImage ? (
                <img
                  src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL + f.url}
                  alt={f.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-muted text-muted-foreground">
                  <FileIcon className="h-5 w-5" />
                  <span className="mt-1 text-[8px] uppercase">{f.type}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================== */
/* SIDE BUTTON */
/* ================================================== */

function SideButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-[72px] flex-col items-center gap-1.5 px-1 py-4 text-[11px] transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ================================================== */
/* TOOLBAR BUTTON */
/* ================================================== */

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
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

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-border" />;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
