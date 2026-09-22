"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  FileText,
  File,
  Hash,
  Sigma,
  User,
  Users,
  Link2,
  Clock3,
  Type,
  Search,
  History,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type ColumnType =
  | "STATUS"
  | "TEXT"
  | "PERSON"
  | "DATE"
  | "NUMBER"
  | "FILE"
  | "TIMELINE"
  | "CHECKBOX"
  | "CREATION_LOG"

interface ColumnTypeItem {
  label: string;
  type: ColumnType;
  category: "Essentials" | "Super useful";
  icon: React.ElementType;
  color: string;
}

const COLUMN_TYPES: ColumnTypeItem[] = [
  {
    label: "Status",
    type: "STATUS",
    category: "Essentials",
    icon: ChevronDown,
    color: "bg-green-500",
  },
  {
    label: "Text",
    type: "TEXT",
    category: "Essentials",
    icon: Type,
    color: "bg-yellow-500",
  },
  {
    label: "Person",
    type: "PERSON",
    category: "Essentials",
    icon: User,
    color: "bg-sky-500",
  },
  {
    label: "Date",
    type: "DATE",
    category: "Essentials",
    icon: Calendar,
    color: "bg-purple-500",
  },
  {
    label: "Numbers",
    type: "NUMBER",
    category: "Essentials",
    icon: Hash,
    color: "bg-amber-500",
  },
  {
    label: "Files",
    type: "FILE",
    category: "Super useful",
    icon: File,
    color: "bg-red-400",
  },

  {
    label: "Timeline",
    type: "TIMELINE",
    category: "Super useful",
    icon: Clock3,
    color: "bg-purple-500",
  },
  {
    label: "Checkbox",
    type: "CHECKBOX",
    category: "Super useful",
    icon: CheckSquare,
    color: "bg-orange-400",
  },
  {
    label: "Creation Log",
    type: "CREATION_LOG",
    category: "Super useful",
    icon: History,
    color: "bg-teal-500",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ColumnType) => void;
}

export function ColumnTypeModal({
  open,
  onOpenChange,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return COLUMN_TYPES.filter((item) =>
      item.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const essentials = filtered.filter(
    (x) => x.category === "Essentials"
  );

  const useful = filtered.filter(
    (x) => x.category === "Super useful"
  );

  
  const renderSection = (
    title: string,
    items: ColumnTypeItem[]
  ) => (
    <>
      {items.length > 0 && (
        <>
          <h3 className="mb-3 mt-5 text-sm font-medium text-muted-foreground">
            {title}
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.type}
                  onClick={() => {
                    onSelect(item.type);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted transition"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${item.color}`}
                  >
                    <Icon size={16} />
                  </div>

                  <span className="text-sm font-medium">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Select Column Type</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3 top-3 text-muted-foreground"
            size={16}
          />

          <Input
            className="pl-9"
            placeholder="Search or describe your column"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {renderSection("Essentials", essentials)}
        {renderSection("Super useful", useful)}
      </DialogContent>
    </Dialog>
  );
}