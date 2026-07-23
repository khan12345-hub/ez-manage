"use client";

import { File as FileIcon, Paperclip } from "lucide-react";

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

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setPreviewOpen(true)}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        {value.files.length} files
      </Button>

      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        files={value.files}
        onUploadClick={() => setUploadOpen(true)}
      />

      <FileUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        cellId={value.cellId}
        onUploadSuccess={()=>setPreviewOpen(true)}
      />
    </>
  );
}
