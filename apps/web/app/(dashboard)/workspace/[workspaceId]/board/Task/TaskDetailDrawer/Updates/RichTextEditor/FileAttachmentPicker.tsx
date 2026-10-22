"use client";

import {
  forwardRef,
  useImperativeHandle,
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
  onFilesChange?: (files: File[]) => void;
}

export interface FileAttachmentPickerHandle {
  addFiles: (files: File[]) => void;
}

export const FileAttachmentPicker = forwardRef<
  FileAttachmentPickerHandle,
  FileAttachmentPickerProps
>(function FileAttachmentPicker({ onFilesChange }, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Mutable ref so the imperative handle always sees the latest files
  // without needing to be in its dependency array.
  const filesRef = useRef<File[]>(files);
  filesRef.current = files;

  useImperativeHandle(ref, () => ({
    addFiles: (newFiles: File[]) => {
      const updated = [...filesRef.current, ...newFiles];
      setFiles(updated);
      onFilesChange?.(updated);
    },
  }));

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;
    const updated = [...files, ...selectedFiles];
    setFiles(updated);
    onFilesChange?.(updated);
    event.target.value = "";
  }

  function handleRemoveFile(index: number) {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange?.(updated);
  }

  return (
    <>
      {files.length > 0 && (
        <FileAttachmentPreview files={files} onRemove={handleRemoveFile} />
      )}

      <div className="flex items-center justify-end border-t bg-muted/30 px-2 py-1">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
});
