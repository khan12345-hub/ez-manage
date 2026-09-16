"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusOption = {
  id: number;
  label: string;
  color: string;
};

type Props = {
  options: StatusOption[];
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  onSelect: (optionId: number) => void;
};

export default function AutomationStatusOptionPicker({
  options,
  value,
  disabled = false,
  placeholder = "something",
  onSelect,
}: Props) {
  const selectedValue =
    value !== undefined && value !== ""
      ? String(value)
      : undefined;

  return (
    <Select
      value={selectedValue}
      disabled={disabled}
      onValueChange={(nextValue) => {
        onSelect(Number(nextValue));
      }}
    >
      <SelectTrigger className="h-auto w-auto min-w-[150px] border-0 bg-transparent px-1 py-0 text-lg sm:text-[25px] shadow-none focus:ring-0">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.id}
            value={String(option.id)}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: option.color,
                }}
              />

              {option.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}