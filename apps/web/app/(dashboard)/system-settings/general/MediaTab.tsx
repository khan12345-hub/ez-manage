"use client";

import { File, HardDrive } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { StatCard } from "./StatCard";
import { DeleteDialog } from "./DeleteDialog";
import { RowActions } from "./RowActions";
import { MediaFile } from "./types";

const mockMedia: MediaFile[] = [
  {
    id: 1,
    name: "design.png",
    type: "Image",
    size: "2.4 MB",
    location: "Marketing Campaign",
  },
  {
    id: 2,
    name: "requirements.pdf",
    type: "Document",
    size: "842 KB",
    location: "Authentication",
  },
  {
    id: 3,
    name: "demo.mp4",
    type: "Video",
    size: "42 MB",
    location: "Dashboard",
  },
];

export function MediaTab() {
  const [selectedFile, setSelectedFile] =
    useState<MediaFile | null>(null);

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
          value="1,284"
          description="184 uploaded this month"
          icon={File}
        />

        <StatCard
          title="Total Storage"
          value="4.82 GB"
          description="48% of available storage"
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
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {mockMedia.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <File className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <span className="font-medium">
                          {file.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <Badge variant="outline">
                        {file.type}
                      </Badge>
                    </td>

                    <td className="px-5 py-4">
                      {file.size}
                    </td>

                    <td className="px-5 py-4 text-muted-foreground">
                      {file.location}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <RowActions
                        onEdit={() => {}}
                        onDelete={() => setSelectedFile(file)}
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
        onOpenChange={(open) =>
          !open && setSelectedFile(null)
        }
        title="Delete file?"
        description={`"${selectedFile?.name}" will be permanently removed.`}
      />
    </div>
  );
}

