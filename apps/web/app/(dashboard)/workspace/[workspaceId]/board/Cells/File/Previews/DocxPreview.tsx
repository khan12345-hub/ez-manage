"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocxPreviewProps {
  url: string;
  fileName: string;
}

export default function DocxPreview({ url, fileName }: DocxPreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true); setHtml(null); setError(false);
    import("mammoth/mammoth.browser")
      .then((mammoth) =>
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
          .then((result) => setHtml(result.value))
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading document…</span>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Preview unavailable for this document.</p>
        <Button asChild>
          <a href={url} download={fileName} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto rounded-lg border bg-white">
      <div
        className="prose prose-sm max-w-none p-8 text-gray-800 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:p-1.5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
