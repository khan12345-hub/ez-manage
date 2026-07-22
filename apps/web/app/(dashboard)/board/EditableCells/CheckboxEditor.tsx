"use client";

import { Checkbox } from "@/components/ui/checkbox";

import { CellEditorProps } from "./EditableCell";

export interface CheckboxValue {
  checked: boolean;
}

export function CheckboxEditor({
  value,
  setValue,
  save,
}: CellEditorProps<CheckboxValue>) {
  const checked = value?.checked ?? false;

  const handleChange = (newChecked: boolean) => {
    const newValue = {
      checked: newChecked,
    };

    setValue(newValue);
    save(newValue);
  };

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => {
          handleChange(value === true);
        }}
        className="cursor-pointer"
      />
    </div>
  );
}