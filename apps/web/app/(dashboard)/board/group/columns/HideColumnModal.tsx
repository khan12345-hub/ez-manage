"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: any[];
  hiddenColumns: number[];
  onToggle: (columnId: number) => void;
  onToggleAll: (boolean: boolean) => void;
}

export function HideColumnModal({
  open,
  onOpenChange,
  columns,
  hiddenColumns,
  onToggle,
  onToggleAll,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredColumns = useMemo(() => {
    return columns.filter((column) =>
      column.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [columns, search]);

  const visibleCount = columns.length - hiddenColumns.length;

  const allSelected = hiddenColumns.length === 0;
  const partiallySelected =
    hiddenColumns.length > 0 && hiddenColumns.length < columns.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Display columns</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder="Find columns to show/hide"
            />
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-4 flex items-center gap-3">
            <Checkbox
              checked={
                allSelected ? true : partiallySelected ? "indeterminate" : false
              }
              onCheckedChange={(checked) => onToggleAll(checked === true)}
            />

            <div className="font-medium">
              All columns{" "}
              <span className="text-sm text-muted-foreground">
                {visibleCount} selected
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-auto">
            {filteredColumns.map((column) => {
              const checked = !hiddenColumns.includes(column.id);

              return (
                <label
                  key={column.id}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggle(column.id)}
                  />

                  <span>{column.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
