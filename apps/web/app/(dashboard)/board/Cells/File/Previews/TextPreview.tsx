"use client";

import { useEffect, useState } from "react";

interface TextPreviewProps {
  url: string;
}

export default function TextPreview({
  url,
}: TextPreviewProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadText = async () => {
      try {
        const response = await fetch(url);
        const text = await response.text();

        if (!cancelled) {
          setContent(text);
        }
      } catch (error) {
        console.error(
          "Text preview error:",
          error,
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadText();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  return (
    <pre className="max-h-[70vh] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
      {content}
    </pre>
  );
}