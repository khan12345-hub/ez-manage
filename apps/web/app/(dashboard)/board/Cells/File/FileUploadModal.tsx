"use client";

import { File as FileIcon, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";

import { uploadTaskCellFiles } from "@/services/tasks.api";
import { useInviteModalStore } from "@/store/invite-modal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import FileThumbnail from "./Previews/FilePreviewItemThumbnail";

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cellId: number;
  onUploadSuccess: () => void;
}

export function FileUploadModal({
  open,
  onOpenChange,
  cellId,
  onUploadSuccess,
}: FileUploadModalProps) {
  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadTaskCellFiles(boardId, cellId, files),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      setSelectedFiles([]);
      onOpenChange(false);
      onUploadSuccess();
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(event.target.files ?? []);

    if (newFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }

    // Allow selecting the same file again
    event.target.value = "";
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) =>
      prev.filter((_, fileIndex) => fileIndex !== index),
    );
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;

    uploadMutation.mutate(selectedFiles);
  };

  const handleClose = (open: boolean) => {
    if (!open && !uploadMutation.isPending) {
      setSelectedFiles([]);
    }

    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-scroll scrollbar-none">
          {/* Upload Dropzone */}
          <label
            htmlFor="file-upload"
            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-10 text-center transition-all hover:border-primary/50 hover:bg-muted/40"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border transition-transform group-hover:scale-105">
              <Upload className="h-5 w-5 text-primary" />
            </div>

            <p className="text-sm font-semibold">Click to upload files</p>

            <p className="mt-1 text-xs text-muted-foreground">
              Select one or multiple files
            </p>

            <span className="mt-4 rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors group-hover:bg-muted">
              Choose files
            </span>

            <input
              id="file-upload"
              type="file"
              multiple
              disabled={uploadMutation.isPending}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Files ready to upload</p>

                <p className="text-xs text-muted-foreground">
                  {selectedFiles.length}{" "}
                  {selectedFiles.length === 1 ? "file" : "files"}
                </p>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 rounded-md border bg-background p-3"
                  >
                    {/* Preview */}
                    {/* {file.type.startsWith("image/") ? (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                        <Image
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )} */}
                    <FileThumbnail
                      fileName={file.name}
                      mimeType={file.type}
                    />

                    {/* File Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    {/* Remove */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={uploadMutation.isPending}
                      onClick={() => removeSelectedFile(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {selectedFiles.length > 0 && (
            <Button
              type="button"
              className="w-full"
              disabled={uploadMutation.isPending}
              onClick={handleUpload}
            >
              <Upload className="mr-2 h-4 w-4" />

              {uploadMutation.isPending
                ? "Uploading..."
                : `Upload ${selectedFiles.length} ${
                    selectedFiles.length === 1 ? "file" : "files"
                  }`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
