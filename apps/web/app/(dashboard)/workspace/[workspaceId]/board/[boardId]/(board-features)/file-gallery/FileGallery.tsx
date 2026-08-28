"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Clock3,
  FileIcon,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FilePreviewModal } from "./FileGalleryPreviewModal";

import { getBoardFiles, type BoardGalleryFile } from "@/services/boards.api";
import { useParams } from "next/navigation";

/* -------------------------------------------------- */
/* Types */
/* -------------------------------------------------- */

type GalleryFile = BoardGalleryFile;

/* -------------------------------------------------- */
/* Main Gallery */
/* -------------------------------------------------- */

export function FileGallery({}) {
  const params = useParams();

  const boardId = Number(params.boardId);
  const [selectedFile, setSelectedFile] = useState<GalleryFile | null>(null);

  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  /* -------------------------------------------------- */
  /* Fetch board files */
  /* -------------------------------------------------- */

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

  /* -------------------------------------------------- */
  /* Search */
  /* -------------------------------------------------- */

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return files;
    }

    return files.filter((file) => {
      return (
        file.name.toLowerCase().includes(query) ||
        file.taskName.toLowerCase().includes(query) ||
        file.boardName.toLowerCase().includes(query)
      );
    });
  }, [files, search]);

  /* -------------------------------------------------- */
  /* Render */
  /* -------------------------------------------------- */

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      {/* ------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------ */}

      <div className="flex h-10 items-center justify-between border-b px-2">
        {/* Left */}
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

        {/* View mode */}
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

      {/* ------------------------------------------------ */}
      {/* Content */}
      {/* ------------------------------------------------ */}

      <div className="p-5">
        {/* Search */}
        <div className="mb-2 flex items-center justify-between">
          <div className="relative w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files or tasks"
              className="h-7 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Count */}
        <div className="mb-7 text-xs text-muted-foreground">
          {isLoading ? (
            "Loading files..."
          ) : (
            <>
              Showing {filteredFiles.length} out of {files.length} files
            </>
          )}
        </div>

        {/* ------------------------------------------------ */}
        {/* Loading */}
        {/* ------------------------------------------------ */}

        {isLoading && <GallerySkeleton />}

        {/* ------------------------------------------------ */}
        {/* Error */}
        {/* ------------------------------------------------ */}

        {!isLoading && isError && <ErrorGallery onRetry={() => refetch()} />}

        {/* ------------------------------------------------ */}
        {/* Empty */}
        {/* ------------------------------------------------ */}

        {!isLoading && !isError && filteredFiles.length === 0 && (
          <EmptyGallery hasSearch={Boolean(search.trim())} />
        )}

        {/* ------------------------------------------------ */}
        {/* Grid */}
        {/* ------------------------------------------------ */}

        {!isLoading &&
          !isError &&
          filteredFiles.length > 0 &&
          viewMode === "grid" && (
            <GridView files={filteredFiles} onSelect={setSelectedFile} />
          )}

        {/* ------------------------------------------------ */}
        {/* List */}
        {/* ------------------------------------------------ */}

        {!isLoading &&
          !isError &&
          filteredFiles.length > 0 &&
          viewMode === "list" && (
            <ListView files={filteredFiles} onSelect={setSelectedFile} />
          )}
      </div>

      {/* ------------------------------------------------ */}
      {/* Preview Modal */}
      {/* ------------------------------------------------ */}

      <FilePreviewModal
        file={selectedFile}
        files={filteredFiles}
        onClose={() => setSelectedFile(null)}
        onNavigate={(nextFile: GalleryFile) => setSelectedFile(nextFile)}
      />
    </div>
  );
}

/* ================================================== */
/* Grid View */
/* ================================================== */

function GridView({
  files,
  onSelect,
}: {
  files: GalleryFile[];
  onSelect: (file: GalleryFile) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {files.map((file) => (
        <FileCard key={file.id} file={file} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ================================================== */
/* File Card */
/* ================================================== */

function FileCard({
  file,
  onSelect,
}: {
  file: GalleryFile;
  onSelect: (file: GalleryFile) => void;
}) {
  const isImage = file.type === "image";

  return (
    <div className="group w-[165px]">
      {/* Preview */}
      <div className="relative h-[110px] overflow-hidden rounded-md border bg-muted/20">
        {/* Main preview */}
        <button
          type="button"
          onClick={() => onSelect(file)}
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

        {/* Version */}

        {/* More options */}
        <button
          type="button"
          className="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
          title="More options"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {/* Open */}
      </div>

      {/* Filename */}
      <div
        className="mt-2 truncate text-xs text-muted-foreground"
        title={file.name}
      >
        {file.name}
      </div>

      {/* Task name */}
      <div
        className="mt-1 truncate text-[11px] text-muted-foreground"
        title={file.taskName}
      >
        {file.taskName}
      </div>

      {/* Updated */}
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
  onSelect,
}: {
  files: GalleryFile[];
  onSelect: (file: GalleryFile) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      {files.map((file) => {
        const isImage = file.type === "image";

        return (
          <div
            key={file.id}
            className="group flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
            onClick={() => onSelect(file)}
          >
            {/* Preview */}
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
              {/* Filename */}
              <p className="truncate text-sm" title={file.name}>
                {file.name}
              </p>

              {/* Task */}
              <p
                className="truncate text-xs text-muted-foreground"
                title={file.taskName}
              >
                {file.taskName}
              </p>

              {/* Updated */}
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3 shrink-0" />

                {formatDate(file.updatedAt)}
              </div>
            </div>

            {/* Version */}

            {/* More */}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
              title="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
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
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="w-[165px] animate-pulse">
          {/* Image */}
          <div className="h-[110px] rounded-md bg-muted" />

          {/* Filename */}
          <div className="mt-2 h-3 w-32 rounded bg-muted" />

          {/* Task */}
          <div className="mt-2 h-2.5 w-24 rounded bg-muted" />

          {/* Date */}
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

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
