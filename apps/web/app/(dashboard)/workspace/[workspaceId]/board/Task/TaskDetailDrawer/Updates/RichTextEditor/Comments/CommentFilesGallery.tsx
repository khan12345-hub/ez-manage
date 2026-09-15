"use client";

import { useState } from "react";
import FileThumbnail from "../../../../../Cells/File/Previews/FilePreviewItemThumbnail";
import { CommentFilesPreviewModal, CommentFile } from "./CommentFilesPreviewModal";

interface Props {
  files: CommentFile[];
}

export function CommentFilesGallery({ files }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!files?.length) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {files.map((file, i) => (
          <button
            key={file.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="group relative h-20 w-20 overflow-hidden rounded-md border bg-muted transition hover:border-primary hover:ring-2 hover:ring-primary/20"
            title={file.fileName}
          >
            <FileThumbnail
              fileName={file.fileName}
              mimeType={file.mimeType}
              url={file.url}
            />
            {/* Dark overlay on hover */}
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <CommentFilesPreviewModal
          files={files}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onNavigate={setActiveIndex}
        />
      )}
    </>
  );
}
