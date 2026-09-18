"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileIcon,
  Grid2X2,
  List,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { FilePreviewModal } from "./FileGalleryPreviewModal";
import {
  deleteBoardFile,
  getBoardFiles,
  type BoardGalleryFile,
} from "@/services/boards.api";
import { getErrorMessage } from "@/lib/error-message";

type FileType = "all" | "image" | "pdf" | "video" | "audio" | "document" | "excel";

const TYPE_TABS: { label: string; value: FileType }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "PDFs", value: "pdf" },
  { label: "Documents", value: "document" },
  { label: "Excel", value: "excel" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
];

const PAGE_SIZE = 80;

export function FileGallery() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<BoardGalleryFile | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [fileToDelete, setFileToDelete] = useState<BoardGalleryFile | null>(null);
  const [activeType, setActiveType] = useState<FileType>("all");
  const [page, setPage] = useState(1);

  /* Debounce search */
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const handleTypeChange = (t: FileType) => {
    setActiveType(t);
    setPage(1);
  };

  const queryKey = ["board-files", boardId, activeType, debouncedSearch, page];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      getBoardFiles(boardId, {
        type: activeType === "all" ? undefined : activeType,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: Number.isFinite(boardId) && boardId > 0,
    placeholderData: (prev) => prev,
  });

  const files = data?.files ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  /* Delete mutation */
  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => deleteBoardFile(boardId, fileId),
    onSuccess: () => {
      toast.success("File deleted");
      queryClient.invalidateQueries({ queryKey: ["board-files", boardId] });
      if (selectedFile?.id === fileToDelete?.id) setSelectedFile(null);
      setFileToDelete(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete file"));
      setFileToDelete(null);
    },
  });

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b px-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center text-muted-foreground">
            <span className="text-[16px] leading-none">⠿</span>
          </div>
          <h2 className="truncate text-sm font-medium">Files Gallery</h2>
          <button
            type="button"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Filter files"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={viewMode === "grid" ? "outline" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <Grid2X2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={viewMode === "list" ? "outline" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b bg-muted/30 px-3 py-1.5 scrollbar-none">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTypeChange(tab.value)}
            className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              activeType === tab.value
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Search + count */}
        <div className="mb-3 flex items-center gap-3">
          <div className="relative w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search files or tasks"
              className="h-7 pl-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : `${total.toLocaleString()} file${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading && <GallerySkeleton />}
        {!isLoading && isError && <ErrorGallery onRetry={() => refetch()} />}
        {!isLoading && !isError && files.length === 0 && (
          <EmptyGallery hasSearch={Boolean(debouncedSearch) || activeType !== "all"} />
        )}

        {!isLoading && !isError && files.length > 0 && viewMode === "grid" && (
          <GridView
            files={files}
            onOpen={setSelectedFile}
            onDownload={handleDownloadFile}
            onDelete={setFileToDelete}
          />
        )}
        {!isLoading && !isError && files.length > 0 && viewMode === "list" && (
          <ListView
            files={files}
            onOpen={setSelectedFile}
            onDownload={handleDownloadFile}
            onDelete={setFileToDelete}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {getPaginationRange(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(Number(p))}
                    className={`flex h-7 min-w-7 items-center justify-center rounded px-2 text-xs font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        files={files}
        onClose={() => setSelectedFile(null)}
        onNavigate={setSelectedFile}
        onDelete={setFileToDelete}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => { if (!open) setFileToDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{fileToDelete?.name}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (fileToDelete) deleteMutation.mutate(fileToDelete.id); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function handleDownloadFile(file: BoardGalleryFile) {
  const link = document.createElement("a");
  link.href = process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url;
  link.download = file.name;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/* ── Pagination helper ── */
function getPaginationRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const left = current - delta;
  const right = current + delta;
  const range: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i <= right)) range.push(i);
  }
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of range) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

/* ── File type icon ── */
function FileTypeIcon({ type, className = "h-7 w-7" }: { type: string; className?: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-500",
    image: "text-blue-500",
    video: "text-purple-500",
    audio: "text-green-500",
    document: "text-blue-700",
    excel: "text-emerald-600",
    archive: "text-amber-500",
  };
  const labels: Record<string, string> = {
    pdf: "PDF", image: "IMG", video: "VID", audio: "AUD",
    document: "DOC", excel: "XLS", archive: "ZIP", file: "FILE",
  };
  return (
    <div className={`flex flex-col items-center justify-center gap-1 ${colors[type] ?? "text-muted-foreground"}`}>
      <FileIcon className={className} />
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">
        {labels[type] ?? type.toUpperCase()}
      </span>
    </div>
  );
}

/* ── Grid view ── */
function GridView({
  files, onOpen, onDownload, onDelete,
}: {
  files: BoardGalleryFile[];
  onOpen: (f: BoardGalleryFile) => void;
  onDownload: (f: BoardGalleryFile) => void;
  onDelete: (f: BoardGalleryFile) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {files.map((file) => (
        <FileCard key={file.id} file={file} onOpen={onOpen} onDownload={onDownload} onDelete={onDelete} />
      ))}
    </div>
  );
}

function FileCard({
  file, onOpen, onDownload, onDelete,
}: {
  file: BoardGalleryFile;
  onOpen: (f: BoardGalleryFile) => void;
  onDownload: (f: BoardGalleryFile) => void;
  onDelete: (f: BoardGalleryFile) => void;
}) {
  const isImage = file.type === "image";

  return (
    <div className="group w-[165px]">
      <div className="relative h-[110px] overflow-hidden rounded-md border bg-muted/20">
        <button
          type="button"
          onClick={() => onOpen(file)}
          className="block h-full w-full cursor-pointer overflow-hidden"
        >
          {isImage ? (
            <img
              src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url}
              alt={file.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileTypeIcon type={file.type} />
            </div>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpen(file)}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open file
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(file)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 truncate text-xs font-medium" title={file.name}>{file.name}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={file.taskName}>{file.taskName}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3 shrink-0" />
        <span>{formatDate(file.updatedAt)}</span>
      </div>
    </div>
  );
}

/* ── List view ── */
function ListView({
  files, onOpen, onDownload, onDelete,
}: {
  files: BoardGalleryFile[];
  onOpen: (f: BoardGalleryFile) => void;
  onDownload: (f: BoardGalleryFile) => void;
  onDelete: (f: BoardGalleryFile) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      {files.map((file) => {
        const isImage = file.type === "image";
        return (
          <div
            key={file.id}
            className="group flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
            onClick={() => onOpen(file)}
          >
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted">
              {isImage ? (
                <img
                  src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url}
                  alt={file.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <FileTypeIcon type={file.type} className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={file.taskName}>{file.taskName}</p>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3 shrink-0" />
                {formatDate(file.updatedAt)}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(file); }}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(file); }} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className="w-[165px] animate-pulse">
          <div className="h-[110px] rounded-md bg-muted" />
          <div className="mt-2 h-3 w-32 rounded bg-muted" />
          <div className="mt-1.5 h-2.5 w-24 rounded bg-muted" />
          <div className="mt-1.5 h-2.5 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ErrorGallery({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center">
      <p className="text-sm font-medium">Failed to load files</p>
      <Button variant="outline" size="sm" className="mt-4 h-7 text-xs" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function EmptyGallery({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center text-muted-foreground">
      <FileIcon className="mb-3 h-10 w-10 opacity-30" />
      <p className="text-sm font-medium">
        {hasSearch ? "No files found" : "No files yet"}
      </p>
      <p className="mt-1 text-xs">
        {hasSearch ? "Try a different filter or search term." : "Files uploaded to tasks will appear here."}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
