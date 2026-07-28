import {
  Download,
  FileIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface File {
  fileName: string;
  mimeType: string;
}

interface UnsupportedFilePreviewProps {
  file: File;
  url?: string;
}

export default function UnsupportedFilePreview({
  file,
  url,
}: UnsupportedFilePreviewProps) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FileIcon className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="text-center">
        <p className="font-medium">
          {file.fileName}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Preview is not available for this file type.
        </p>
      </div>

      {url && (
        <Button asChild>
          <a
            href={url}
            download={file.fileName}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      )}
    </div>
  );
}