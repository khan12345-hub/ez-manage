"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleIcon,
  Download,
  Expand,
  EyeOff,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Trash2,
  X,
  History,
} from "lucide-react";

import { useEffect } from "react";

interface GalleryFile {
  id: number;
  name: string;
  url: string;
  type: "image" | "file";
  version?: string;
  updatedAt: string;
  boardName?: string;
  taskName?: string;
}

interface FilePreviewModalProps {
  file: GalleryFile | null;
  files: GalleryFile[];
  onClose: () => void;
  onNavigate: (file: GalleryFile) => void;
}

export function FilePreviewModal({
  file,
  files,
  onClose,
  onNavigate,
}: FilePreviewModalProps) {
  /**
   * Current file index
   */
  const currentIndex = file
    ? files.findIndex((item) => item.id === file.id)
    : -1;

  const canGoPrevious = currentIndex > 0;

  const canGoNext = currentIndex >= 0 && currentIndex < files.length - 1;

  /**
   * Previous
   */
  const goPrevious = () => {
    if (!canGoPrevious) return;

    const previousFile = files[currentIndex - 1];

    if (!previousFile) return;

    onNavigate(previousFile);
  };

  const goNext = () => {
    if (!canGoNext) return;

    const nextFile = files[currentIndex + 1];

    if (!nextFile) return;

    onNavigate(nextFile);
  };

  /**
   * Keyboard navigation
   */
  useEffect(() => {
    if (!file) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        goNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    /**
     * Prevent background scrolling.
     */
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = "";
    };
  }, [file, currentIndex, files]);

  if (!file) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-background/95"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        /**
         * Close when clicking the background.
         */
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="absolute inset-x-0 top-0 z-30 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* File icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" />
          </div>

          {/* File information */}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </div>

            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {file.boardName && (
                <>
                  <span>{file.boardName}</span>

                  <span>›</span>
                </>
              )}

              {file.taskName && (
                <>
                  <span>{file.taskName}</span>

                  <span>›</span>
                </>
              )}

              <span>{file.updatedAt}</span>
            </div>
          </div>
        </div>

        {/* Close */}
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
      {/* MAIN IMAGE AREA */}
      {/* ================================================== */}

      <div className="absolute inset-0 flex items-center justify-center px-24 pb-20 pt-20">
        <img
          src={file.url}
          alt={file.name}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
        />
      </div>

      {/* ================================================== */}
      {/* PREVIOUS */}
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

      {/* ================================================== */}
      {/* NEXT */}
      {/* ================================================== */}

      <button
        type="button"
        disabled={!canGoNext}
        onClick={goNext}
        className="absolute right-[90px] top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:pointer-events-none disabled:opacity-20"
        title="Next"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* ================================================== */}
      {/* RIGHT SIDEBAR */}
      {/* ================================================== */}

      <div className="absolute right-0 top-16 bottom-0 z-30 flex w-[78px] flex-col items-center border-l bg-background">
        <ViewerSideButton
          icon={<MessageCircle className="h-5 w-5" />}
          label="Comments"
        />

        <ViewerSideButton
          icon={<History className="h-5 w-5" />}
          label="Versions"
        />

        <ViewerSideButton
          icon={<ImageIcon className="h-5 w-5" />}
          label="Gallery"
          active
        />

        <ViewerSideButton
          icon={<CircleIcon className="h-5 w-5" />}
          label="Info"
        />

        <ViewerSideButton
          icon={<RefreshCw className="h-5 w-5" />}
          label="Extract"
          disabled
        />
      </div>

      {/* ================================================== */}
      {/* BOTTOM TOOLBAR */}
      {/* ================================================== */}

      <div className="absolute bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-md border bg-background px-2 py-1.5 shadow-lg">
        <ViewerToolbarButton
          icon={<MessageCircle className="h-4 w-4" />}
          label="Comment"
        />

        <ToolbarDivider />

        <ViewerToolbarButton
          icon={<EyeOff className="h-4 w-4" />}
          label="Hide"
        />

        <ViewerToolbarButton
          icon={<Expand className="h-4 w-4" />}
          label="Fullscreen"
          onClick={() => {
            document.documentElement.requestFullscreen?.();
          }}
        />

        <ViewerToolbarButton
          icon={<RefreshCw className="h-4 w-4" />}
          label="Refresh"
        />

        <ViewerToolbarButton
          icon={<Download className="h-4 w-4" />}
          label="Download"
          onClick={() => {
            const link = document.createElement("a");

            link.href = file.url;
            link.download = file.name;
            link.target = "_blank";

            document.body.appendChild(link);
            link.click();
            link.remove();
          }}
        />

        <ViewerToolbarButton
          icon={<ChevronRight className="h-4 w-4 rotate-90" />}
          label="More"
        />

        <ToolbarDivider />

        <ViewerToolbarButton
          icon={<Printer className="h-4 w-4" />}
          label="Print"
          onClick={() => {
            window.print();
          }}
        />

        <ViewerToolbarButton
          icon={<Trash2 className="h-4 w-4" />}
          label="Delete"
        />
      </div>

      {/* Image counter */}
      {files.length > 1 && (
        <div className="absolute bottom-5 left-5 z-30 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}

/* ================================================== */
/* SIDEBAR BUTTON */
/* ================================================== */

function ViewerSideButton({
  icon,
  label,
  active = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full cursor-pointer flex-col items-center gap-1.5 px-1 py-4 text-[11px] transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon}

      <span>{label}</span>
    </button>
  );
}

/* ================================================== */
/* TOOLBAR BUTTON */
/* ================================================== */

function ViewerToolbarButton({
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
