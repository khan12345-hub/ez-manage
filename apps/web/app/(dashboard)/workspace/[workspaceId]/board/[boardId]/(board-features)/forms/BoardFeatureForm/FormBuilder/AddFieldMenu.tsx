"use client";

import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FormFieldType } from "./board-feature-form.types";

interface AddFieldMenuProps {
  onAdd: (type: FormFieldType) => void;
  variant?: "default" | "ghost" | "outline";
  children?: React.ReactNode;
}

export const ALLOWED_FORM_FIELDS: { type: FormFieldType; label: string }[] = [
  { type: "TEXT", label: "Text" },
  { type: "NUMBER", label: "Number" },
  { type: "DATE", label: "Date" },
  { type: "TIMELINE", label: "Timeline" },
  { type: "STATUS", label: "Status / Dropdown" },
  { type: "CHECKBOX", label: "Checkbox" },
  { type: "LINK", label: "Link (URL)" },
  { type: "FILE", label: "File Upload" },
];

export function AddFieldMenu({ onAdd, variant = "default", children }: AddFieldMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <Button variant={variant} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Add field
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-44">
        {ALLOWED_FORM_FIELDS.map((field) => (
          <DropdownMenuItem key={field.type} onClick={() => onAdd(field.type)}>
            {field.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
