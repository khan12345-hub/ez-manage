interface VideoPreviewProps {
  url: string;
}

export default function VideoPreview({
  url,
}: VideoPreviewProps) {
  return (
    <div className="flex h-[70vh] items-center justify-center">
      <video
        src={url}
        controls
        className="max-h-full max-w-full rounded-md"
      >
        Your browser does not support video
        playback.
      </video>
    </div>
  );
}