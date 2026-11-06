"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SWATCHES = ["#047857", "#0b2a1f", "#b08d57", "#2563EB", "#7C3AED", "#DB2777", "#DC2626", "#D97706", "#0D9488", "#475569"];

export interface NameDialogResult {
  name: string;
  color?: string;
  isPrivate?: boolean;
}

/** Small create/rename dialog used for spaces, folders and lists. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Name",
  placeholder,
  initial,
  submitLabel = "Create",
  withColor = false,
  withPrivacy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initial?: Partial<NameDialogResult>;
  submitLabel?: string;
  withColor?: boolean;
  withPrivacy?: boolean;
  onSubmit: (r: NameDialogResult) => Promise<unknown> | void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? SWATCHES[0]!);
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setColor(initial?.color ?? SWATCHES[0]!);
      setIsPrivate(initial?.isPrivate ?? false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), ...(withColor ? { color } : {}), ...(withPrivacy ? { isPrivate } : {}) });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.response?.data?.message?.toString?.() ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-[24px] font-normal">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="name-dialog-input" className="text-[13px] font-medium">{label}</label>
            <Input id="name-dialog-input" autoFocus value={name} placeholder={placeholder} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>

          {withColor && (
            <div className="space-y-1.5">
              <span className="text-[13px] font-medium">Colour</span>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className={cn("h-7 w-7 rounded-md transition-transform hover:scale-110", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {withPrivacy && (
            <label className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span>
                <span className="block text-[13px] font-medium">Private</span>
                <span className="block text-xs text-muted-foreground">Only people you add (and workspace admins) can see it.</span>
              </span>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </label>
          )}

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || busy}>{busy ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
