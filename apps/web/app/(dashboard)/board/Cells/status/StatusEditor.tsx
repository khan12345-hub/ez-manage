"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Tag } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CellEditorProps } from "../../EditableCells/EditableCell";
import { StatusColorPicker } from "./StatusColorPicker";

const DEFAULT_STATUSES = [
  {
    value: "working",
    label: "Working on it",
    color: "#fdab3d",
  },
  {
    value: "stuck",
    label: "Stuck",
    color: "#e2445c",
  },
  {
    value: "done",
    label: "Done",
    color: "#00c875",
  },
  {
    value: "blank",
    label: "Default Label",
    color: "#c4c4c4",
  },
];
export interface StatusValue {
  label: string;
  color: string;
}
export function StatusEditor({
  value,
  setValue,
  save,
  isDragging,
}: CellEditorProps<StatusValue> & {
  isDragging?: boolean;
}) {
  const [mode, setMode] = useState<"picker" | "edit">("picker");
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [open, setOpen] = useState(true);
  const current = statuses.find((s) => s.label === value?.label) ?? statuses[0];

  const updateLabel = (index: number, label: string) => {
    setStatuses((prev) =>
      prev.map((s, i) => (i === index ? { ...s, label } : s)),
    );
  };

  const addLabel = () => {
    setStatuses((prev) => [
      ...prev,
      {
        value: crypto.randomUUID(),
        label: "New Label",
        color: "#c4c4c4",
      },
    ]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!isDragging) {
          setOpen(v);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="absolute top-0 left-0 cursor-pointer flex items-center h-full w-full justify-center text-sm font-medium text-white"
          style={{ background: current?.color }}
        >
          {current?.label}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3" align="start">
        {mode === "picker" ? (
          <div className="space-y-2">
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => {
                  const newValue = {
                    label: status.label,
                    color: status.color,
                  };

                  setValue(newValue);
                  save(newValue);
                  setOpen(!open);
                }}
                className="relative flex h-10 w-full items-center justify-center rounded text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: status.color }}
              >
                {status.label}

                {value && value.label === status.value && (
                  <Check className="absolute right-3 h-4 w-4" />
                )}
              </button>
            ))}

            <button
              onClick={() => setMode("edit")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
              Edit Labels
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {statuses.map((status, index) => (
              <div
                key={status.value}
                className={cn(
                  "flex items-center gap-2 rounded-md border p-2",
                  value &&
                    value.label === status.value &&
                    "border-primary ring-1 ring-primary",
                )}
              >
                <StatusColorPicker
                  value={status.color}
                  onChange={(color) => {
                    setStatuses((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, color } : s)),
                    );
                  }}
                >
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded text-white transition hover:scale-105"
                    style={{ backgroundColor: status.color }}
                  >
                    <Tag className="h-4 w-4" />
                  </button>
                </StatusColorPicker>

                <Input
                  value={status.label}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
                />
              </div>
            ))}

            <Button variant="outline" className="w-full" onClick={addLabel}>
              <Plus className="mr-2 h-4 w-4" />
              New label
            </Button>

            <Button
              className="w-full"
              onClick={() => {
                // TODO: Call update status labels API here.
                setMode("picker");
              }}
            >
              Apply
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
