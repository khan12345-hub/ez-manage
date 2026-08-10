"use client";

import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FormFieldType } from "./board-feature-form.types";

interface AddFieldMenuProps {
  onAdd: (type: FormFieldType) => void;
}

const fields: {
  type: FormFieldType;
  label: string;
}[] = [
  { type: "TEXT", label: "Text" },
  // { type: "EMAIL", label: "Email" },
  { type: "NUMBER", label: "Number" },
  { type: "DATE", label: "Date" },
  { type: "TIMELINE", label: "Timeline" },
  { type: "SELECT", label: "Select" },
  { type: "CHECKBOX", label: "Checkbox" },
];

export function AddFieldMenu({
  onAdd,
}: AddFieldMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {fields.map((field) => (
          <DropdownMenuItem
            key={field.type}
            onClick={() => onAdd(field.type)}
          >
            {field.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}