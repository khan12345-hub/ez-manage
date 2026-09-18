"use client";

import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { deleteBoardFile } from "@/services/boards.api";
import { getErrorMessage } from "@/lib/error-message";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { FileItem, TaskFile } from "./FileItem";
import SingleFilePreviewModal from "../../../Cells/File/Previews/SingleFilePreviewModal";

interface FilesTabProps {
  taskId: number;
}

async function fetchTaskFiles(taskId: number): Promise<TaskFile[]> {
  const response = await api.get<TaskFile[]>(`/tasks/${taskId}/files`);
  return response.data;
}

export function FilesTab({ taskId }: FilesTabProps) {
  const params = useParams();
  const boardId = Number(params.boardId);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);
  const [fileToDelete, setFileToDelete] = useState<TaskFile | null>(null);

  /* Fetch */
  const { data: files = [], isLoading, isError, refetch } = useQuery<TaskFile[]>({
    queryKey: ["task-files", taskId],
    queryFn: () => fetchTaskFiles(taskId),
    enabled: taskId > 0,
    staleTime: 30_000,
  });

  /* Search filter */
  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) =>
        f.fileName.toLowerCase().includes(q) ||
        (f.columnName ?? "").toLowerCase().includes(q),
    );
  }, [files, search]);

  /* Delete mutation */
  const deleteMutation = useMutation({
    mutationFn: (fileId: number) => deleteBoardFile(boardId, fileId),
    onSuccess: () => {
      toast.success("File deleted");
      queryClient.invalidateQueries({ queryKey: ["task-files", taskId] });
      setFileToDelete(null);
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Failed to delete file"));
      setFileToDelete(null);
    },
  });

  const handleDownload = (file: TaskFile) => {
    const href = file.url.startsWith("http")
      ? file.url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = file.fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /* Loading */
  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* Error */
  if (isError) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Failed to load files.</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-medium underline">
          Try again
        </button>
      </div>
    );
  }

  /* Empty */
  if (files.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
        <div className="rounded-full bg-muted p-4">
          <span className="text-2xl">📁</span>
        </div>
        <h3 className="mt-4 text-sm font-semibold">No files yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Files uploaded to comments and Files columns will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        {search && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {filteredFiles.length} of {files.length} files
          </p>
        )}
      </div>

      {/* File list */}
      <div className="flex flex-col gap-2 px-4">
        {filteredFiles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No files match your search.</p>
        ) : (
          filteredFiles.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onOpen={setPreviewFile}
              onDownload={handleDownload}
              onDelete={setFileToDelete}
            />
          ))
        )}
      </div>

      {/* Direct file preview */}
      <SingleFilePreviewModal
        file={previewFile}
        files={files}
        onClose={() => setPreviewFile(null)}
        onNavigate={(f) => setPreviewFile(f)}
        onDelete={(f) => setFileToDelete(f)}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={fileToDelete !== null}
        onOpenChange={(open) => { if (!open) setFileToDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{fileToDelete?.fileName}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (fileToDelete) deleteMutation.mutate(fileToDelete.id); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
