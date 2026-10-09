"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CopyFormLinkButtonProps {
  boardId: number;
  /** undefined means the form has not been saved yet */
  formId?: number;
  /** UUID share token — when present the public URL uses this instead of numeric boardId */
  shareToken?: string | null;
}

export function CopyFormLinkButton({ boardId, formId, shareToken }: CopyFormLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!formId) return;
    const slug = shareToken ?? boardId;
    const url = `${window.location.origin}/form/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!formId) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy form link
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Save the form first to get a shareable link
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          Copy form link
        </>
      )}
    </Button>
  );
}
