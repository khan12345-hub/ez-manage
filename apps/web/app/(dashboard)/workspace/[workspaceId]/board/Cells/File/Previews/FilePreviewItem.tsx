"use client";

import { Trash2 } from "lucide-react";
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

interface FilePreviewItemProps {
  file: FilePreviewItemType;
  cellId?: number;
  commentId?: number;
}

export default function FilePreviewItem({
  file,
  cellId,
  commentId,
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

  console.log({
    file
  });
  // Don't render anything after successful deletion
  if (deleted) {
    return null;
  }

  return (
    <>
      {/* File Row */}
      <div className="group flex items-center gap-3 rounded-md border p-3">
        {/* Preview thumbnail */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="shrink-0"
        >
          <FileThumbnail
            fileName={file.fileName}
            mimeType={file.mimeType}
            url={file.url}
          />
        </button>

        {/* File information */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="line-clamp-2 text-sm font-medium hover:underline">
            {file.fileName}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.fileSize)}
          </p>
        </button>

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

      {/* File Preview */}
      <SingleFilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={file}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>

            <AlertDialogDescription className="max-w-82!">
              Are you sure you want to delete{" "}
              <span className="line-clamp-2 font-medium text-foreground">
                {file.fileName}?
              </span>{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            {/* Cancel */}
            <Button
              type="button"
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>

            {/* Delete */}
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
