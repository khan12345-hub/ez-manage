"use client";

import ExcelIcon from "@/components/ui/icons/ExcelIcon";
import PdfIcon from "@/components/ui/icons/PdfIcon";
import { File as FileIcon } from "lucide-react";

interface FileThumbnailProps {
  fileName: string;
  mimeType?: string | null;
  url?: string | null;
  size?: "sm" | "md";
}

export default function FileThumbnail({
  fileName,
  mimeType,
  url,
  size = "md",
}: FileThumbnailProps) {
  const lowerFileName = fileName?.toLowerCase();

  const isImage =
    mimeType?.startsWith("image/") ||
    lowerFileName.endsWith(".png") ||
    lowerFileName.endsWith(".jpg") ||
    lowerFileName.endsWith(".jpeg") ||
    lowerFileName.endsWith(".gif") ||
    lowerFileName.endsWith(".webp");

  const isExcel =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    lowerFileName.endsWith(".xlsx") ||
    lowerFileName.endsWith(".xls");

  const isPdf =
    mimeType === "application/pdf" || lowerFileName.endsWith(".pdf");

  const fileUrl = url
    ? url.startsWith("http")
      ? url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${url}`
    : null;

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
  };

  const dimensions = {
    sm: 40,
    md: 48,
  };


  
  return (
    <div
      className={`${sizeClasses[size]} relative shrink-0 overflow-hidden rounded-md`}
    >
      {isImage && fileUrl ? (
        <img
          src={fileUrl}
          alt={fileName}
          className="h-full w-full object-cover"
        />
      ) : isExcel ? (
        <ExcelIcon size={dimensions[size]} className="h-full w-full" />
      ) : isPdf ? (
        <PdfIcon size={dimensions[size]} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md bg-muted">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}