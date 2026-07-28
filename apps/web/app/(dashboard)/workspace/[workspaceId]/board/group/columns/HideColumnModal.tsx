"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  columns: any[];

  hiddenColumnIds: number[];

  allColumnsVisible: boolean;

  onToggleColumn: (id: number) => void;

  onToggleAllColumns: (checked: boolean) => void;
}

export function HideColumnModal({
  open,
  onOpenChange,
  columns,
  hiddenColumnIds,
  allColumnsVisible,
  onToggleColumn,
  onToggleAllColumns,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Hide Columns
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show / Hide All */}
          <div className="flex items-center gap-3 border-b pb-3">
            <Checkbox
              checked={allColumnsVisible}
              onCheckedChange={(checked) =>
                onToggleAllColumns(
                  checked === true,
                )
              }
            />

            <span className="text-sm font-medium">
              Show all columns
            </span>
          </div>

          {/* Columns */}
          <div className="space-y-2">
            {columns.map((column: any) => {
              const isVisible =
                !hiddenColumnIds.includes(
                  column.id,
                );

              return (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={() =>
                      onToggleColumn(
                        column.id,
                      )
                    }
                  />

                  <span className="text-sm">
                    {column.name}
                  </span>
                </label>
              );
            })}

            {columns.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No columns available to hide.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}