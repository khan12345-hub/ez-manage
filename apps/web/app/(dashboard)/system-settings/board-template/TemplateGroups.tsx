"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  TemplateColumn,
  TemplateGroup,
} from "./template.types";

import { TemplateGroupCard } from "./TemplateGroupCard";

interface TemplateGroupsProps {
  groups: TemplateGroup[];

  onAddGroup: () => void;

  onDeleteGroup: (
    groupId: string,
  ) => void;

  onGroupChange: (
    groupId: string,
    changes: Partial<TemplateGroup>,
  ) => void;

  onAddColumn: (
    groupId: string,
  ) => void;

  onDeleteColumn: (
    groupId: string,
    columnId: string,
  ) => void;

  onColumnChange: (
    groupId: string,
    columnId: string,
    changes: Partial<TemplateColumn>,
  ) => void;
}

export function TemplateGroups({
  groups,
  onAddGroup,
  onDeleteGroup,
  onGroupChange,
  onAddColumn,
  onDeleteColumn,
  onColumnChange,
}: TemplateGroupsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Groups
          </h3>

          <p className="text-xs text-muted-foreground">
            Define the groups and columns for the board.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddGroup}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add group
        </Button>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <TemplateGroupCard
            key={group.id}
            group={group}
            
            canDelete={groups.length > 1}
            onChange={(changes) =>
              onGroupChange(
                group.id,
                changes,
              )
            }
            onDelete={() =>
              onDeleteGroup(group.id)
            }
            onAddColumn={() =>
              onAddColumn(group.id)
            }
            onDeleteColumn={(columnId) =>
              onDeleteColumn(
                group.id,
                columnId,
              )
            }
            onColumnChange={(
              columnId,
              changes,
            ) =>
              onColumnChange(
                group.id,
                columnId,
                changes,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}