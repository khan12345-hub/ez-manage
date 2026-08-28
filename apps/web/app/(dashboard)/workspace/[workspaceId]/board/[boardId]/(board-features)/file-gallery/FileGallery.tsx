"use client";

import { useMemo, useState } from "react";

import {
  Clock3,
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

interface GalleryFile {
  id: number;
  name: string;
  url: string;
  type: "image" | "file";
  version?: string;
  updatedAt: string;
  boardName:string;
  taskName:string;
}

const MOCK_FILES: GalleryFile[] = [
  {
    id: 1,
    name: "cb167ae82a34505fa8e2e77.jpg",
    url: "https://placehold.co/800x800/ef233c/000000?text=Image+1",
    type: "image",
    version: "V1",
    updatedAt: "Update",
    boardName: "New Board",
    taskName: "Item 1",
  },
  {
    id: 2,
    name: "2ac53d3c8ad60454cb6e011e58fb9f71.jpg",
    url: "https://placehold.co/800x800/e88ac7/000000?text=Image+2",
    type: "image",
    version: "V1",
    updatedAt: "Update",
    boardName: "New Board",
    taskName: "Item 3",
  },
];

export function FileGallery() {
  const [selectedFile, setSelectedFile] = useState<GalleryFile | null>(null);
  const [files] = useState<GalleryFile[]>(MOCK_FILES);

  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return files;
    }

    return files.filter((file) => file.name.toLowerCase().includes(query));
  }, [files, search]);

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
        {/* Search */}
        <div className="mb-2 flex items-center justify-between">
          <div className="relative w-[160px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search for files"
              className="h-7 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Count */}
        <div className="mb-7 text-xs text-muted-foreground">
          Showing {filteredFiles.length} out of {files.length} files
        </div>

        {filteredFiles.length === 0 ? (
          <EmptyGallery />
        ) : viewMode === "grid" ? (
          <GridView onSelect={setSelectedFile} files={filteredFiles} />
        ) : (
          <ListView files={filteredFiles} />
        )}
      </div>

      <FilePreviewModal
        file={selectedFile}
        files={filteredFiles}
        onClose={() => setSelectedFile(null)}
        onNavigate={(nextFile:any) => setSelectedFile(nextFile)}
      />
    </div>
  );
}

/* -------------------------------------------------- */
/* Grid View */
/* -------------------------------------------------- */

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

/* -------------------------------------------------- */
/* File Card */
/* -------------------------------------------------- */

function FileCard({
  file,
  onSelect,
}: {
  file: GalleryFile;
  onSelect: (file: GalleryFile) => void;
}) {
  return (
    <>
      <div className="group w-[165px]">
        {/* Preview */}
        <div className="relative h-[110px] overflow-hidden rounded-md border bg-muted/20">
          {/* Version */}
          {file.version && (
            <button
              type="button"
              onClick={() => onSelect(file)}
              className="relative block h-[110px] w-full cursor-pointer overflow-hidden rounded-md border bg-muted/20"
            >
              {/* Version */}
              {file.version && (
                <div className="absolute bottom-0 left-0 z-10 flex h-6 w-8 items-center justify-center bg-background/90 text-[10px] text-muted-foreground">
                  {file.version}
                </div>
              )}

              <img
                src={file.url}
                alt={file.name}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </button>
          )}

          {/* Action */}
          <button
            type="button"
            className="absolute right-1 top-1 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
            title="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {/* Add / preview action */}
          <button
            type="button"
            className="absolute bottom-0 left-8 z-10 flex h-6 w-8 cursor-pointer items-center justify-center bg-background/90 text-muted-foreground hover:text-foreground"
            title="Open file"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <img
            src={file.url}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Filename */}
        <div
          className="mt-2 truncate text-xs text-muted-foreground"
          title={file.name}
        >
          {file.name}
        </div>

        {/* Updated */}
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          <span>{file.updatedAt}</span>
        </div>
      </div>
      
    </>
  );
}

/* -------------------------------------------------- */
/* List View */
/* -------------------------------------------------- */

function ListView({ files }: { files: GalleryFile[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      {files.map((file) => (
        <div
          key={file.id}
          className="group flex items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
        >
          <div className="h-12 w-16 overflow-hidden rounded border bg-muted">
            <img
              src={file.url}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" title={file.name}>
              {file.name}
            </p>

            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {file.updatedAt}
            </div>
          </div>

          {file.version && (
            <span className="text-xs text-muted-foreground">
              {file.version}
            </span>
          )}

          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded opacity-0 hover:bg-muted group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------- */
/* Empty */
/* -------------------------------------------------- */

function EmptyGallery() {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>

      <p className="text-sm font-medium">No files found</p>

      <p className="mt-1 text-xs text-muted-foreground">
        Try changing your search.
      </p>
    </div>
  );
}
