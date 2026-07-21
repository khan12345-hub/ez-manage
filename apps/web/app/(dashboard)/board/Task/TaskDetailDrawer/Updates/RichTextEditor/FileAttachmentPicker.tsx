"use client";

import {
  useRef,
  useState,
} from "react";

import {
  Paperclip,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  FileAttachmentPreview,
} from "./FileAttachmentPreview";

interface FileAttachmentPickerProps {
  onFilesChange?: (
    files: File[],
  ) => void;
}

export function FileAttachmentPicker({
  onFilesChange,
}: FileAttachmentPickerProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [
    files,
    setFiles,
  ] = useState<File[]>([]);

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles =
      Array.from(
        event.target.files ?? [],
      );

    if (
      selectedFiles.length === 0
    ) {
      return;
    }

    const updatedFiles = [
      ...files,
      ...selectedFiles,
    ];

    setFiles(updatedFiles);

    onFilesChange?.(
      updatedFiles,
    );

    event.target.value = "";
  }

  function handleRemoveFile(
    index: number,
  ) {
    const updatedFiles =
      files.filter(
        (_, fileIndex) =>
          fileIndex !== index,
      );

    setFiles(updatedFiles);

    onFilesChange?.(
      updatedFiles,
    );
  }

  return (
    <>
      {files.length > 0 && (
        <FileAttachmentPreview
          files={files}
          onRemove={handleRemoveFile}
        />
      )}

      <div className="flex items-center justify-end border-t bg-muted/30 px-2 py-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={
            handleFileChange
          }
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() =>
            fileInputRef.current?.click()
          }
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}