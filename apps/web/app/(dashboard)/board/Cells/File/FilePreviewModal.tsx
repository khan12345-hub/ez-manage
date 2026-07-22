"use client";

import { Download } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import FilePreview, {
  FilePreviewItem,
} from "./FilePreview";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FilePreviewItem | null;
}

export default function FilePreviewModal({
  open,
  onOpenChange,
  file,
}: FilePreviewModalProps) {
  if (!file) {
    return null;
  }

  const fileUrl = file.url
    ? file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="truncate">
              {file.fileName}
            </DialogTitle>

            {fileUrl && (
            //   <Button
            //     variant="outline"
            //     size="sm"
            //     asChild
            //   >
            //   </Button>
                <a
                  href={fileUrl}
                  download={file.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
            )}
          </div>
        </DialogHeader>

        <FilePreview file={file} />
      </DialogContent>
    </Dialog>
  );
}