"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Globe, Share2, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWorkspaceDoc } from "@/services/docs.api";

type Privacy = "MAIN" | "PRIVATE" | "SHAREABLE";

const PRIVACY_OPTIONS: { value: Privacy; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "MAIN",      label: "Main",      desc: "Visible to everyone in your workspace", icon: <Globe     className="h-4 w-4" /> },
  { value: "PRIVATE",   label: "Private",   desc: "Only you can see this document",         icon: <Lock      className="h-4 w-4" /> },
  { value: "SHAREABLE", label: "Shareable", desc: "Anyone with the link can view",           icon: <Share2    className="h-4 w-4" /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: number;
}

export function DocCreateModal({ open, onClose, workspaceId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("New Doc");
  const [privacy, setPrivacy] = useState<Privacy>("MAIN");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const doc = await createWorkspaceDoc(workspaceId, { name: name.trim(), privacy });
      await queryClient.invalidateQueries({ queryKey: ["workspace-docs", workspaceId] });
      onClose();
      router.push(`/workspace/${workspaceId}/doc/${doc.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-indigo-500" />
            Create Doc
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Doc name
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Untitled Doc"
              className="text-sm"
            />
          </div>

          {/* Privacy */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Privacy</label>
            <div className="flex gap-2">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  className={`flex flex-1 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    privacy === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {PRIVACY_OPTIONS.find((o) => o.value === privacy)?.desc}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={loading} size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? "Creating…" : "Create Doc"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
