"use client";

import {
  File as FileIcon,
  Paperclip,
} from "lucide-react";

import {
  useState,
} from "react";
import { FileUploadModal } from "./FileUploadModal";



export interface FileItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  url?: string;
}

interface FileCellProps {
  value?:any
}

export function FileCell({

  value
}: FileCellProps) {
  const [
    open,
    setOpen,
  ] = useState(false);
  console.log("cell id",value)
  
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setOpen(true)
        }
        className="flex min-h-8 w-full items-center gap-2 px-2 text-left hover:bg-muted/50"
      >
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />

        {value && value.files.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {value.files.length}{" "}
            {value.files.length === 1
              ? "file"
              : "files"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Add files
          </span>
        )}
      </button>

      <FileUploadModal
        open={open}
        onOpenChange={setOpen}
        cellId={value.cellId}
        files={value.files}
      />
    </>
  );
}