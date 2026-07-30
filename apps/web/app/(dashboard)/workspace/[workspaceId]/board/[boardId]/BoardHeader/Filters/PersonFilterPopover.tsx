"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import PersonPicker, { PersonValue } from "../../../Cells/Person/PersonPicker";

import { getBoardMembers } from "@/services/boards.api";

interface Props {
  boardId: number;
  value: PersonValue | null;
  onChange: (value: PersonValue | null) => void;
}

export function PersonFilter({ boardId, value, onChange }: Props) {
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["board-members", boardId, search],
    queryFn: () => getBoardMembers(boardId, search),
    enabled: !!boardId,
  });

  const handleChange = (selectedValue: PersonValue | null) => {
    // Get selected users from PersonPicker
    console.log("Selected users:", selectedValue?.users);

    // Update parent state
    onChange(selectedValue);
  };

  return (
    <PersonPicker
      value={value}
      onChange={handleChange}
      placeholder="Search people..."
      className="h-9 w-auto px-3"
      type="filter"
    />
  );
}
