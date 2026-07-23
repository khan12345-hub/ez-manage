"use client";

import { Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import FileRow from "./FilePreviewItem";
import FilePreviewItem from "./FilePreviewItem";

interface FileItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url?: string;
}

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileItem[];
  cellId?: number;
  onUploadClick?: () => void;
  type?: "COMMENT" | "CELL";
}

export function FilePreviewModal({
  open,
  onOpenChange,
  files,
  cellId,
  onUploadClick,
  type,
}: FilePreviewModalProps) {
  const handleUploadClick = () => {
    onOpenChange(false);
    onUploadClick?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uploaded files ({files.length})</DialogTitle>
        </DialogHeader>

        <div className="max-w-2xl overflow-scroll scrollbar-none space-y-4">
          {/* Uploaded files */}
          {files.length > 0 ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-md p-2">
              <div className="space-y-2">
                {files.map((file) => (
                  <FilePreviewItem cellId={cellId} key={file.id} file={file} />
                ))}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
              <p className="text-sm font-medium">No files uploaded</p>

              <p className="mt-1 text-xs text-muted-foreground">
                There are no files attached to this cell.
              </p>
            </div>
          )}

          {/* Upload button */}
          {type === "CELL" && (
            <Button
              type="button"
              className="w-full"
              onClick={handleUploadClick}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload files
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
