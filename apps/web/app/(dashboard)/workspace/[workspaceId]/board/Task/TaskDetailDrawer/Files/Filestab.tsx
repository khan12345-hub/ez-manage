"use client";

import { useState } from "react";
import {
  Loader2,
  Columns3,
  MessageCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";


import FileThumbnail from "../../../Cells/File/Previews/FilePreviewItemThumbnail";
import { api } from "@/lib/api";
import { FileUploaderAvatar } from "./FileUploaderAvatar";
import { FileItem, TaskFile } from "./FileItem";
import { FilePreviewModal } from "../../../Cells/File/Previews/FilePreviewModal";

/* =========================================================
   Props
========================================================= */

interface FilesTabProps {
  taskId: number;
}

async function getTaskFiles(
  taskId: number,
): Promise<TaskFile[]> {
  const response = await api.get<TaskFile[]>(
    `/tasks/${taskId}/files`,
  );

  return response.data;
}

export function FilesTab({
  taskId,
}: FilesTabProps) {
  const [selectedFile, setSelectedFile] =
    useState<TaskFile | null>(null);

  const {
    data: files = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<TaskFile[]>({
    queryKey: ["task-files", taskId],

    queryFn: async () => {
      console.log(
        "[FilesTab] Fetching files for task:",
        taskId,
      );

      const response = await api.get<TaskFile[]>(
        `/tasks/${taskId}/files`,
      );

      console.log(
        "[FilesTab] Files:",
        response.data,
      );

      return response.data;
    },

    enabled: taskId > 0,

    staleTime: 30_000,
  });

  console.log("[FilesTab] Render:", {
    taskId,
    isLoading,
    isError,
    files,
    error,
  });

  /* =======================================================
     Loading
  ======================================================= */

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* =======================================================
     Error
  ======================================================= */

  if (isError) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          Failed to load files.
        </p>

        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm font-medium underline"
        >
          Try again
        </button>
      </div>
    );
  }

  /* =======================================================
     Empty
  ======================================================= */

  if (files.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <div className="rounded-full bg-muted p-4">
          <span className="text-2xl">
            📁
          </span>
        </div>

        <h3 className="mt-4 text-sm font-semibold">
          No files yet
        </h3>

        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Files uploaded to comments and
          Files columns will appear here.
        </p>
      </div>
    );
  }

  /* =======================================================
     Render
  ======================================================= */

  return (
    <>
      <div className="flex flex-col gap-2 px-4">
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            onClick={() =>
              setSelectedFile(file)
            }
          />
        ))}
      </div>

      {selectedFile && (
        <FilePreviewModal
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedFile(null);
            }
          }}
          files={[selectedFile]}
          commentId={
            selectedFile.source ===
            "COMMENT"
              ? selectedFile.commentId
              : undefined
          }
        />
      )}
    </>
  );
}