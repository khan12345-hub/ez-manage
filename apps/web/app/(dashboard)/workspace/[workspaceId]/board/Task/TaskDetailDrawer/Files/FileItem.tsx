"use client";

import { Columns3, Download, ExternalLink, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getTaskFiles } from "@/services/tasks.api";
import FileThumbnail from "../../../Cells/File/Previews/FilePreviewItemThumbnail";
import { FileUploaderAvatar } from "./FileUploaderAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const taskFilesKeys = {
  all: ["task-files"] as const,
  list: (taskId: number) => [...taskFilesKeys.all, taskId] as const,
};

export function useTaskFiles(taskId?: number) {
  return useQuery<TaskFile[]>({
    queryKey: taskFilesKeys.list(taskId!),
    queryFn: () => getTaskFiles(taskId!),
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
  commentId?: number;
  parentCommentId?: number | null;
  cellId?: number;
  columnId?: number;
  columnName?: string;
  uploadedBy: TaskFileUser | null;
}

interface FileItemProps {
  file: TaskFile;
  onOpen: (file: TaskFile) => void;
  onDownload: (file: TaskFile) => void;
  onDelete: (file: TaskFile) => void;
}

export function FileItem({ file, onOpen, onDownload, onDelete }: FileItemProps) {
  const uploaderName = file.uploadedBy
    ? `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`
    : undefined;

  return (
    <div className="group flex w-full items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40">
      {/* Thumbnail — click opens preview */}
      <button
        type="button"
        onClick={() => onOpen(file)}
        className="shrink-0 cursor-pointer"
      >
        <FileThumbnail
          fileName={file.fileName}
          mimeType={file.mimeType}
          url={file.url}
        />
      </button>

      {/* Info — click opens preview */}
      <button
        type="button"
        onClick={() => onOpen(file)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium">{file.fileName}</p>

        <div className="mt-1 flex items-center gap-1.5">
          {file.source === "COMMENT" ? (
            <>
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Update</span>
            </>
          ) : (
            <>
              <Columns3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {file.columnName ?? "Files column"}
              </span>
            </>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          {file.uploadedBy && (
            <FileUploaderAvatar name={uploaderName} avatarUrl={file.uploadedBy.avatarUrl} />
          )}
          <span className="text-xs text-muted-foreground">
            {format(new Date(file.uploadedAt), "MMM d, yyyy")}
          </span>
        </div>
      </button>

      {/* Context menu — shown on hover */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            title="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onOpen(file)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open file
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDownload(file)}>
            <Download className="mr-2 h-4 w-4" />
            Download file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(file)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
