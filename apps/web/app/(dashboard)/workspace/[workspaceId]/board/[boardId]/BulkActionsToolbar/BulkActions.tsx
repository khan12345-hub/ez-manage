"use client";

import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BulkActionsProps } from "./bulkactionstoolbar.types";



export function BulkActions({
  isBusy = false,
  isDeleting = false,
  onDelete,
  onClear,
}: BulkActionsProps) {
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-9"
        disabled={isBusy}
        onClick={onDelete}
      >
        {isDeleting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}

        {isDeleting ? "Deleting..." : "Delete"}
      </Button>

      <Separator
        orientation="vertical"
        className="h-6"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isBusy}
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  );
}