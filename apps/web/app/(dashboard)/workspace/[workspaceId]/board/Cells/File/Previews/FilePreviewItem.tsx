"use client";

import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteTaskCellFile } from "@/services/tasks.api";
import { deleteCommentFile } from "@/services/comments.api";

import { useInviteModalStore } from "@/store/invite-modal";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";

import { FilePreviewItemType } from "./FilePreview";
import SingleFilePreviewModal from "./SingleFilePreviewModal";
import FileThumbnail from "./FilePreviewItemThumbnail";

import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

interface FilePreviewItemProps {
  file: FilePreviewItemType;
  cellId?: number;
  commentId?: number;
  imageOnlyPreview?: boolean;
}

export default function FilePreviewItem({
  file,
  cellId,
  commentId,
  imageOnlyPreview,
}: FilePreviewItemProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const queryClient = useQueryClient();

  const { boardId, boardRole, workspaceRole } = useInviteModalStore();
  const { user } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete Task Cell File
      if (cellId) {
        return deleteTaskCellFile(boardId, cellId, file.id);
      }

      // Delete Comment File
      if (commentId) {
        return deleteCommentFile(commentId, file.id);
      }

      throw new Error("Unable to determine file owner");
    },

    onSuccess: async () => {
      // Immediately remove the file from this UI
      setDeleted(true);

      // Close preview if it is open
      setPreviewOpen(false);

      // Close confirmation dialog
      setDeleteDialogOpen(false);

      // Invalidate cell-related queries
      if (cellId) {
        await queryClient.invalidateQueries({
          queryKey: ["board", boardId],
        });
      }

      // Invalidate comment-related queries
      if (commentId) {
        await queryClient.invalidateQueries({
          queryKey: ["task-comments", boardId],
        });
      }

      toast.success("File deleted successfully!");
    },

    onError: (error: any) => {
      console.error("Failed to delete file:", error);

      const message =
        error?.response?.data?.message ||
        "Failed to delete file. Please try again.";

      toast.error(Array.isArray(message) ? message.join(", ") : message);
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB"];

    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${parseFloat(
      (bytes / Math.pow(1024, index)).toFixed(2),
    )} ${units[index]}`;
  };

  const boardAccess = boardRole === "OWNER" || boardRole === "ADMIN";

  const workspaceAccess =
    workspaceRole === "OWNER" || workspaceRole === "ADMIN";

  const isFileUploader = user.id === file.uploadedById;

  const canDelete = boardAccess || workspaceAccess || isFileUploader;

  // Don't render anything after successful deletion
  if (deleted) {
    return null;
  }
  // @ts-ignore
  const renderedFile = file.file ?? file

  const sk = renderedFile.storageKey ?? "";

  /*
   * While the background import is running, storageKey is the original
   * external URL. Show an amber placeholder instead of a broken preview.
   */
  const isImporting = sk.startsWith("http://") || sk.startsWith("https://");

  /*
   * After all retries failed, storageKey is prefixed with "import-failed:".
   * Show a red placeholder so the user knows this file needs to be re-uploaded.
   */
  const isImportFailed = sk.startsWith("import-failed:");

  if (isImporting) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-amber-700 dark:text-amber-400">
            {renderedFile.fileName}
          </p>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70">
            Importing to server…
          </p>
        </div>
      </div>
    );
  }

  if (isImportFailed) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-red-700 dark:text-red-400">
            {renderedFile.fileName}
          </p>
          <p className="text-[11px] text-red-600/70 dark:text-red-500/70">
            Import failed — delete and upload manually
          </p>
        </div>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="shrink-0 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
            title="Delete this file record"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* File Row */}
      {imageOnlyPreview ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="cursor-pointer shrink-0"
        >
          <FileThumbnail
            fileName={file.fileName}
            mimeType={file.mimeType}
            url={file.url}
          />
        </button>
      ) : (
        <div className="group flex items-center gap-3 rounded-md border p-3">
          {/* Preview thumbnail */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="shrink-0"
          >
            <FileThumbnail
              fileName={renderedFile.fileName}
              mimeType={renderedFile.mimeType}
              url={renderedFile.url}
            />
          </button>

          {/* File information */}
          {
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="line-clamp-2 text-sm font-medium hover:underline">
                {renderedFile.fileName}
              </p>

              <p className="text-xs text-muted-foreground">
                {formatFileSize(renderedFile.fileSize)}
              </p>
            </button>
          }

          {/* Delete */}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteDialogOpen(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* File Preview */}
      <SingleFilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={renderedFile}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deleteMutation.mutate()}
        isDeleting={deleteMutation.isPending}
        title="Delete this file?"
        description={
          `
            Are you sure you want to delete{" "}
            ${<span className="line-clamp-2 font-medium text-foreground">
              {renderedFile.fileName}
            </span>}
            This action cannot be undone.
          `
        }
      />
    </>
  );
}
