"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import {
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

type GalleryFile = BoardGalleryFile;

/* ================================================== */
/* Main Gallery */
/* ================================================== */

export function FileGallery() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<GalleryFile | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [fileToDelete, setFileToDelete] = useState<GalleryFile | null>(null);

  /* Fetch */
  const {
    data: files = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["board-files", boardId],
    queryFn: () => getBoardFiles(boardId),
    enabled: Number.isFinite(boardId) && boardId > 0,
  });

  /* Delete mutation */
  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => deleteBoardFile(boardId, fileId),
    onSuccess: () => {
      toast.success("File deleted");
      queryClient.invalidateQueries({ queryKey: ["board-files", boardId] });
      if (selectedFile?.id === fileToDelete?.id) {
        setSelectedFile(null);
      }
      setFileToDelete(null);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Failed to delete file"));
      setFileToDelete(null);
    },
  });

  /* Search filter */
  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return files;
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(query) ||
        f.taskName.toLowerCase().includes(query) ||
        f.boardName.toLowerCase().includes(query),
    );
  }, [files, search]);

  const handleOpenFile = (file: GalleryFile) => setSelectedFile(file);

  const handleDownloadFile = (file: GalleryFile) => {
    const link = document.createElement("a");
    link.href = process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url;
    link.download = file.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDeleteFile = (file: GalleryFile) => setFileToDelete(file);

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

      {/* Content */}
      <div className="p-5">
        {/* Search + count */}
        <div className="mb-2 flex items-center gap-3">
          <div className="relative w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files or tasks"
              className="h-7 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="mb-7 text-xs text-muted-foreground">
          {isLoading ? (
            "Loading files..."
          ) : (
            <>Showing {filteredFiles.length} of {files.length} files</>
          )}
        </div>

        {isLoading && <GallerySkeleton />}

        {!isLoading && isError && <ErrorGallery onRetry={() => refetch()} />}

        {!isLoading && !isError && filteredFiles.length === 0 && (
          <EmptyGallery hasSearch={Boolean(search.trim())} />
        )}

        {!isLoading && !isError && filteredFiles.length > 0 && viewMode === "grid" && (
          <GridView
            files={filteredFiles}
            onOpen={handleOpenFile}
            onDownload={handleDownloadFile}
            onDelete={handleDeleteFile}
          />
        )}

        {!isLoading && !isError && filteredFiles.length > 0 && viewMode === "list" && (
          <ListView
            files={filteredFiles}
            onOpen={handleOpenFile}
            onDownload={handleDownloadFile}
            onDelete={handleDeleteFile}
          />
        )}
      </div>

      {/* Preview Modal */}
      <FilePreviewModal
        file={selectedFile}
        files={filteredFiles}
        onClose={() => setSelectedFile(null)}
        onNavigate={(f) => setSelectedFile(f)}
        onDelete={handleDeleteFile}
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
              &ldquo;{fileToDelete?.name}&rdquo; will be permanently deleted and
              cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (fileToDelete) deleteMutation.mutate(fileToDelete.id);
              }}
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

/* ================================================== */
/* Grid View */
/* ================================================== */

function GridView({
  files,
  onOpen,
  onDownload,
  onDelete,
}: {
  files: GalleryFile[];
  onOpen: (file: GalleryFile) => void;
  onDownload: (file: GalleryFile) => void;
  onDelete: (file: GalleryFile) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onOpen={onOpen}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

/* ================================================== */
/* File Card */
/* ================================================== */

function FileCard({
  file,
  onOpen,
  onDownload,
  onDelete,
}: {
  file: GalleryFile;
  onOpen: (file: GalleryFile) => void;
  onDownload: (file: GalleryFile) => void;
  onDelete: (file: GalleryFile) => void;
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
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileIcon className="h-7 w-7" />
              <span className="text-[10px] uppercase">{file.type}</span>
            </div>
          )}
        </button>

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
              title="More options"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpen(file)}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open file
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file)}>
              <Download className="mr-2 h-4 w-4" />
              Download file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(file)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 truncate text-xs text-muted-foreground" title={file.name}>
        {file.name}
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground" title={file.taskName}>
        {file.taskName}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3 shrink-0" />
        <span>{formatDate(file.updatedAt)}</span>
      </div>
    </div>
  );
}

/* ================================================== */
/* List View */
/* ================================================== */

function ListView({
  files,
  onOpen,
  onDownload,
  onDelete,
}: {
  files: GalleryFile[];
  onOpen: (file: GalleryFile) => void;
  onDownload: (file: GalleryFile) => void;
  onDelete: (file: GalleryFile) => void;
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
            {/* Thumbnail */}
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted">
              {isImage ? (
                <img
                  src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL + file.url}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <FileIcon className="h-5 w-5" />
                  <span className="text-[8px] uppercase">{file.type}</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm" title={file.name}>{file.name}</p>
              <p className="truncate text-xs text-muted-foreground" title={file.taskName}>
                {file.taskName}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3 shrink-0" />
                {formatDate(file.updatedAt)}
              </div>
            </div>

            {/* Context menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
                  title="More options"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpen(file); }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open file
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(file); }}>
                  <Download className="mr-2 h-4 w-4" />
                  Download file
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(file); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================== */
/* Loading Skeleton */
/* ================================================== */

function GallerySkeleton() {
  return (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="w-[165px] animate-pulse">
          <div className="h-[110px] rounded-md bg-muted" />
          <div className="mt-2 h-3 w-32 rounded bg-muted" />
          <div className="mt-2 h-2.5 w-24 rounded bg-muted" />
          <div className="mt-2 h-2.5 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/* ================================================== */
/* Error */
/* ================================================== */

function ErrorGallery({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Failed to load files</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Something went wrong while loading the files.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 h-7 text-xs"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}

/* ================================================== */
/* Empty */
/* ================================================== */

function EmptyGallery({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {hasSearch ? "No files found" : "No files yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasSearch
          ? "Try changing your search."
          : "Files uploaded to tasks will appear here."}
      </p>
    </div>
  );
}

/* ================================================== */
/* Date Formatter */
/* ================================================== */

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
