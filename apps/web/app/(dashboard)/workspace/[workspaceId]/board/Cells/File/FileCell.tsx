"use client";

import { Paperclip, UploadIcon } from "lucide-react";
import { useState } from "react";

import { FileUploadModal } from "./FileUploadModal";
import { FilePreviewModal } from "./Previews/FilePreviewModal";
import { Button } from "@/components/ui/button";

export interface FileItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url?: string;
  uploadedById: number;
}

interface FileCellProps {
  value?: {
    files: FileItem[];
    cellId: number;
  } | null;
}

export function FileCell({ value }: FileCellProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const files = value?.files ?? [];
  
  return (
    <>
      {files.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setPreviewOpen(true)}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          {files.length} {files.length === 1 ? "file" : "files"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setUploadOpen(true)}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          Upload Files
        </Button>
      )}

      {previewOpen && value?.cellId != null && (
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          files={files}
          cellId={value.cellId}
          onUploadClick={() => {
            setPreviewOpen(false);
            setUploadOpen(true);
          }}
          type="CELL"
        />
      )}

      {uploadOpen && value?.cellId != null && (
        <FileUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          cellId={value.cellId}
          onUploadSuccess={() => {
            setUploadOpen(false);
            setPreviewOpen(true);
          }}
        />
      )}
    </>
  );
}