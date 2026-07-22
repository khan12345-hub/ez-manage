"use client";

import {
  File as FileIcon,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadTaskCellFiles } from "@/services/tasks.api";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import FileRow from "./FileRow";
import { useInviteModalStore } from "@/store/invite-modal";
import Image from "next/image";

interface FileItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url?: string;
}

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cellId: number;
  files: FileItem[];
}

export function FileUploadModal({
  open,
  onOpenChange,
  cellId,
  files,
}: FileUploadModalProps) {
  const { boardId } = useInviteModalStore();
  const queryClient = useQueryClient();

  // Files selected locally but not uploaded yet
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      uploadTaskCellFiles(boardId, cellId, files),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["board", boardId],
      });

      // Clear selected files after successful upload
      setSelectedFiles([]);
    },
  });

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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

  console.log("files", files)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-max!">
        <DialogHeader>
          <DialogTitle>Files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing uploaded files */}
          {files && files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Uploaded files
              </p>

              {files?.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                />
              ))}
            </div>
          )}

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Files ready to upload
              </p>

              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    {/* Image preview */}
                    {file.type.startsWith("image/") ? (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border">
                        <Image
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* File info */}
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
                      onClick={() =>
                        removeSelectedFile(index)
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {files.length === 0 &&
            selectedFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <FileIcon className="mb-3 h-8 w-8 text-muted-foreground" />

                <p className="text-sm font-medium">
                  No files uploaded
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Select files below to attach them to this cell.
                </p>
              </div>
            )}

          {/* File input / Dropzone */}
          <label
            htmlFor="file-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-muted"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />

            <div>
              <p className="text-sm font-medium">
                Click to select files
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                You can select multiple files
              </p>
            </div>

            <input
              id="file-upload"
              type="file"
              multiple
              disabled={uploadMutation.isPending}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* Upload button */}
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
                    selectedFiles.length === 1
                      ? "file"
                      : "files"
                  }`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}