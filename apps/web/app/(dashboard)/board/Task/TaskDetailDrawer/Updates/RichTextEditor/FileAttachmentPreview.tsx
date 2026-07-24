"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  FileText,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";
import Image from "next/image";

interface FileAttachmentPreviewProps {
  files: File[];

  onRemove: (
    index: number,
  ) => void;
}

export function FileAttachmentPreview({
  files,
  onRemove,
}: FileAttachmentPreviewProps) {
  const [
    previews,
    setPreviews,
  ] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const objectUrls: Record<
      string,
      string
    > = {};

    files.forEach((file) => {
      if (
        file.type.startsWith(
          "image/",
        )
      ) {
        objectUrls[
          getFileKey(file)
        ] =
          URL.createObjectURL(
            file,
          );
      }
    });

    setPreviews(objectUrls);

    return () => {
      Object.values(
        objectUrls,
      ).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [files]);

  return (
    <div className="border-t bg-muted/20 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {files.map(
          (file, index) => {
            const isImage =
              file.type.startsWith(
                "image/",
              );

            const fileKey =
              getFileKey(file);

            return (
              <div
                key={`${fileKey}-${index}`}
                className="relative flex items-center gap-3 rounded-md border bg-background p-2"
              >
                {isImage &&
                previews[fileKey] ? (
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <Image
                      src={
                        previews[
                          fileKey
                        ]
                      }
                      alt={
                        file.name
                      }
                      className="h-full w-full object-cover"
                      height={56}
                      width={56}
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {file.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(
                      file.size,
                    )}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() =>
                    onRemove(index)
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function getFileKey(
  file: File,
) {
  return [
    file.name,
    file.size,
    file.lastModified,
  ].join("-");
}

function formatFileSize(
  size: number,
) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(
      size / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}