"use client";
import ImagePreview from "./Previews/ImagePreview";
import PdfPreview from "./Previews/PdfPreview";
import ExcelPreview from "./Previews/ExcelPreview";
import VideoPreview from "./Previews/VideoPreview";
import AudioPreview from "./Previews/AudioPreview";
import TextPreview from "./Previews/TextPreview";
import UnsupportedFilePreview from "./Previews/UnsupportedPreview";

export interface FilePreviewItem {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url?: string;
}

interface FilePreviewProps {
  file: FilePreviewItem;
}

export default function FilePreview({
  file,
}: FilePreviewProps) {
  if (!file.url) {
    return <UnsupportedFilePreview file={file} />;
  }

  const fileUrl = file.url.startsWith("http")
    ? file.url
    : `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${file.url}`;

  // Images
  if (file.mimeType.startsWith("image/")) {
    return (
      <ImagePreview
        url={fileUrl}
        fileName={file.fileName}
      />
    );
  }

  // PDF
  if (file.mimeType === "application/pdf") {
    return <PdfPreview url={fileUrl} />;
  }

  // Excel
  if (
    file.mimeType.includes("spreadsheet") ||
    file.mimeType.includes("excel") ||
    file.fileName.endsWith(".xlsx") ||
    file.fileName.endsWith(".xls")
  ) {
    return (
      <ExcelPreview
        url={fileUrl}
        fileName={file.fileName}
      />
    );
  }

  // Video
  if (file.mimeType.startsWith("video/")) {
    return <VideoPreview url={fileUrl} />;
  }

  // Audio
  if (file.mimeType.startsWith("audio/")) {
    return <AudioPreview url={fileUrl} />;
  }

  // Text
  if (
    file.mimeType.startsWith("text/") ||
    file.fileName.endsWith(".txt") ||
    file.fileName.endsWith(".csv")
  ) {
    return <TextPreview url={fileUrl} />;
  }

  // Unsupported
  return (
    <UnsupportedFilePreview
      file={file}
      url={fileUrl}
    />
  );
}