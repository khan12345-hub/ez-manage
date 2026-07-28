interface PdfPreviewProps {
  url: string;
}

export default function PdfPreview({
  url,
}: PdfPreviewProps) {
  return (
    <iframe
      src={url}
      title="PDF Preview"
      className="h-[70vh] w-full rounded-md border"
    />
  );
}