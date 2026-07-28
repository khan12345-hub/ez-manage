import Image from "next/image";

interface ImagePreviewProps {
  url: string;
  fileName: string;
}

export default function ImagePreview({
  url,
  fileName,
}: ImagePreviewProps) {
  return (
    <div className="relative flex h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-muted/30 p-4">
      <img
        src={url}
        alt={fileName}
        width={1200}
        height={800}
        className="max-h-full max-w-full rounded-md object-contain"
      />
    </div>
  );
}