"use client";

import { File, HardDrive } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  AdminFile,
  deleteAdminFile,
  getAllFiles,
  getSystemOverview,
} from "@/services/admin.api";
import { StatCard } from "./StatCard";
import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function mimeTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return "Document";
}

export function MediaTab() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<AdminFile | null>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["admin", "files"],
    queryFn: getAllFiles,
    staleTime: 30_000,
  });

  const { data: overview } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getSystemOverview,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "files"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      setSelectedFile(null);
      toast.success("File deleted");
    },
    onError: () => {
      toast.error("Failed to delete file");
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Media</h2>
        <p className="text-sm text-muted-foreground">
          Manage uploaded files and storage usage.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Total Files"
          value={
            overview ? overview.storage.totalFiles.toLocaleString() : "—"
          }
          description={overview ? `${formatBytes(overview.storage.totalBytes)} used` : ""}
          icon={File}
        />
        <StatCard
          title="Total Storage"
          value={overview ? formatBytes(overview.storage.totalBytes) : "—"}
          description={
            overview
              ? `Images ${formatBytes(overview.storage.imageBytes)} · Videos ${formatBytes(overview.storage.videoBytes)}`
              : ""
          }
          icon={HardDrive}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Board</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <Skeleton className="h-4 w-36" />
                          </div>
                        </td>
                        <td className="px-5 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-5 py-4" />
                      </tr>
                    ))
                  : files.map((file) => (
                      <tr
                        key={file.id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <File className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{file.name}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <Badge variant="outline">
                            {mimeTypeLabel(file.mimeType)}
                          </Badge>
                        </td>

                        <td className="px-5 py-4">
                          {formatBytes(file.fileSize)}
                        </td>

                        <td className="px-5 py-4 text-muted-foreground">
                          {file.boardName ?? "—"}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <RowActions
                            onEdit={() => {}}
                            onDelete={() => setSelectedFile(file)}
                            showEdit={false}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DeleteDialog
        open={!!selectedFile}
        onOpenChange={(open) => !open && setSelectedFile(null)}
        title="Delete file?"
        description={`"${selectedFile?.name}" will be permanently removed.`}
        onConfirm={() =>
          selectedFile && deleteMutation.mutate(selectedFile.id)
        }
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
