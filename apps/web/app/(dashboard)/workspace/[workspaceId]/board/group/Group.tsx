"use client";

import { useState } from "react";

import { useInviteModalStore } from "@/store/invite-modal";

import { GroupTable } from "./GroupTable";
import { GroupHeader } from "./GroupHeader";

export function Group({
  group,
  columns,
  selection,
  newTaskFocusToken = 0,
  members,
  ...props
}: any) {
  const { boardId } = useInviteModalStore();

  const [open, setOpen] = useState(false);

  // Tasks are already loaded and assigned to this group
  // by Board.tsx.
  const hydratedGroup = group;

  return (
    <div className="overflow-hidden">
      <GroupHeader
        group={group}
        // focusToken={focusToken}
      />
      <GroupTable
        group={hydratedGroup}
        columns={columns}
        selection={selection}
        showSelection={false}
        showNewTaskRow
        showAddColumn={false}
        setOpen={setOpen}
        newTaskFocusToken={newTaskFocusToken}
        members={members}
      />
    </div>
  );
}

