// FilesTab/TaskFileItem.tsx

"use client";

import { Columns3, MessageCircle } from "lucide-react";

import { format } from "date-fns";


import { useQuery } from "@tanstack/react-query";

import {
  getTaskFiles,
} from "@/services/tasks.api";
import FileThumbnail from "../../../Cells/File/Previews/FilePreviewItemThumbnail";
import { FileUploaderAvatar } from "./FileUploaderAvatar";



export const taskFilesKeys = {
  all: ["task-files"] as const,

  list: (taskId: number) =>
    [...taskFilesKeys.all, taskId] as const,
};

export function useTaskFiles(
  taskId?: number,
) {
  return useQuery<TaskFile[]>({
    queryKey: taskFilesKeys.list(taskId!),

    queryFn: () =>
      getTaskFiles(taskId!),

    enabled: !!taskId,

    staleTime: 30_000,
  });
}

export type TaskFileSource = "COMMENT" | "TASK_CELL";

export interface TaskFileUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface TaskFile {
  id: number;

  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;

  uploadedAt: string;
  uploadedById: number;

  storageKey: string;

  source: "COMMENT" | "TASK_CELL";

  // Comment / Reply
  commentId?: number;
  parentCommentId?: number | null;

  // Task Cell
  columnId?: number;
  columnName?: string;

  uploadedBy: TaskFileUser | null;
}
interface TaskFileItemProps {
  file: TaskFile;
  onClick?: () => void;
}

export function FileItem({ file, onClick }: TaskFileItemProps) {
  const uploaderName = file.uploadedBy
    ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        cursor-pointer
        flex
        w-full
        gap-3
        rounded-xl 
        border
        p-4
        text-left
        transition-colors
        hover:bg-muted/40
      "
    >
      {/* File Preview */}
        <FileThumbnail
          fileName={file.fileName}
          mimeType={file.mimeType}
          url={file.url}
        />
      

      {/* File Information */}
      <div className="min-w-0 flex-1">
        {/* Filename */}
        <p className="truncate text-base font-semibold">{file.fileName}</p>

        {/* Source */}
        <div className="mt-2 flex items-center gap-2">
          {file.source === "COMMENT" ? (
            <>
              <MessageCircle className="h-5 w-5 text-muted-foreground" />

              <span className="text-sm text-muted-foreground">Update</span>
            </>
          ) : (
            <>
              <Columns3 className="h-5 w-5 text-muted-foreground" />

              <span className="text-sm text-muted-foreground">
                {file.columnName ?? "Files column"}
              </span>
            </>
          )}
        </div>

        {/* Uploaded by + Date */}
        <div className="mt-2 flex items-center gap-2">
          {file.uploadedBy && (
            <FileUploaderAvatar
              name={uploaderName}
              avatarUrl={file.uploadedBy.avatarUrl}
            />
          )}

          <span className="text-sm text-muted-foreground">
            {format(new Date(file.uploadedAt), "MMM d, yyyy")}
          </span>
        </div>
      </div>
    </button>
  );
}
