interface AudioPreviewProps {
  url: string;
}

export default function AudioPreview({
  url,
}: AudioPreviewProps) {
  return (
    <div className="flex h-[300px] items-center justify-center">
      <audio
        src={url}
        controls
        className="w-full max-w-md"
      />
    </div>
  );
}