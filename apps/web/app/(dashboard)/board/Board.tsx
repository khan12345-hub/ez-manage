import { Plus } from "lucide-react";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { Group } from "./group/Group";
import { Button } from "@/components/ui/button";
import { useGroupStore } from "@/store/create-group-store";
import { useState } from "react";
import { HideColumnModal } from "./group/columns/HideColumnModal";
// interface Props {
//     board: BoardResponse;
// }

export function Board({ board }: any) {
  const groups = useGroupStore((s) => s.groups);
  const addNewGroup = useGroupStore((s) => s.addNewGroup);
  const hasDraft = groups.some((g) => g.isNew);
  const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);
  const [hideColumnOpen, setHideColumnOpen] = useState(false);
  const toggleColumn = (id: number) => {
    setHiddenColumns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleAllColumns = (checked: boolean) => {
  if (checked) {
    // Show every column
    setHiddenColumns([]);
  } else {
    // Hide every column
    setHiddenColumns(board.columns.map((c:any) => c.id));
  }
};
  return (
    <>
      <BoardHeader 
      onHideColumns={() => setHideColumnOpen(true)}
      board={board} />
      <div className="space-y-6 mb-4">
        {groups.map((group: any) => (
          <Group
            key={group.id}
            group={group}
            columns={board.columns.filter(
              (column: any) => !hiddenColumns.includes(column.id),
            )}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={addNewGroup}
        disabled={hasDraft}
        className="h-12 border-dashed justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Add New Group
      </Button>
      <HideColumnModal
        open={hideColumnOpen}
        onOpenChange={setHideColumnOpen}
        columns={board.columns}
        hiddenColumns={hiddenColumns}
        onToggle={toggleColumn}
        onToggleAll={toggleAllColumns}
      />
    </>
  );
}
