"use client";

import PersonPicker, { PersonValue } from "../../../Cells/Person/PersonPicker";



interface Props {
  value: PersonValue | null;
  onChange: (value: PersonValue | null) => void;
}

export function PersonFilter({
  value,
  onChange,
}: Props) {
  return (
    <PersonPicker
      value={value}
      onChange={onChange}
      placeholder="Search people..."
    //   triggerPlaceholder="Filter by person"
      className="h-9 w-auto px-3"
    />
  );
}