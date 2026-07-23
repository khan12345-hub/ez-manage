"use client";

import ExcelIcon from "@/components/ui/icons/ExcelIcon";
import PdfIcon from "@/components/ui/icons/PdfIcon";
import { File as FileIcon } from "lucide-react";

// import ExcelIcon from "./file-icons/ExcelIcon";
// import PdfIcon from "./file-icons/PdfIcon";

interface FileThumbnailProps {
  fileName: string;
  mimeType?: string;
  url?: string;
  size?: "sm" | "md";
}

export default function FileThumbnail({
  fileName,
  mimeType,
  url,
  size = "md",
}: FileThumbnailProps) {
  const isImage = mimeType?.startsWith("image/");

  const isExcel =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    fileName.toLowerCase().endsWith(".xlsx") ||
    fileName.toLowerCase().endsWith(".xls");

  const isPdf =
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");

  const fileUrl = url
    ? url.startsWith("http")
      ? url
      : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${url}`
    : null;

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
  };

  const iconSize = {
    sm: 40,
    md: 48,
  };

  return (
    <div
      className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-md`}
    >
      {/* Image */}
      {isImage && fileUrl ? (
        <img
          src={fileUrl}
          alt={fileName}
          className="h-full w-full border object-cover"
        />
      ) : isExcel ? (
        /* Excel */
        <ExcelIcon
          size={iconSize[size]}
          className="h-full w-full"
        />
      ) : isPdf ? (
        /* PDF */
        <PdfIcon
          size={iconSize[size]}
          className="h-full w-full"
        />
      ) : (
        /* Generic File */
        <div className="flex h-full w-full items-center justify-center rounded-md bg-muted">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}