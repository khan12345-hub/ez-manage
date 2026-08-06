"use client";

import { File as FileIcon, Paperclip, UploadIcon } from "lucide-react";

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
}

interface FileCellProps {
  value?: any;
}

export function FileCell({ value }: FileCellProps) {
  const [open, setOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  console.log({
    "CELL FILES": value
  })
  return (
    <>
      {value.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setPreviewOpen(true)}
        >
          <Paperclip className="mr-2 h-4 w-4" />
          {value.length} files
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

      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={value}
        cellId={value.cellId}
        onUploadClick={() => setUploadOpen(true)}
        type="CELL"
      />

      <FileUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        cellId={value.cellId}
        onUploadSuccess={() => setPreviewOpen(true)}
      />
    </>
  );
}
