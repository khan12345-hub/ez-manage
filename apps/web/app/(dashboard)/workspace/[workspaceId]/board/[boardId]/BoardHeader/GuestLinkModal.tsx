"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  generateGuestToken,
  getGuestToken,
  revokeGuestToken,
} from "@/services/guest-access.api";

interface Props {
  open: boolean;
  onClose: () => void;
  boardId: number;
}

export function GuestLinkModal({ open, onClose, boardId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const guestUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/guest/${token}`
    : "";

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getGuestToken(boardId)
      .then((res) => setToken(res.token))
      .finally(() => setLoading(false));
  }, [open, boardId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateGuestToken(boardId);
      setToken(res.token);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeGuestToken(boardId);
      setToken(null);
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Guest Access
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Share this board with clients or guests — they can view it without logging in.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : token ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={guestUrl}
                  className="text-xs font-mono h-8"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can view the board.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={handleRevoke}
                  disabled={revoking}
                >
                  {revoking ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3 w-3" />
                  )}
                  Revoke link
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground text-center">
                No guest link yet. Generate one to share this board.
              </p>
              <Button onClick={handleGenerate} disabled={generating} size="sm">
                {generating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Generate guest link
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
