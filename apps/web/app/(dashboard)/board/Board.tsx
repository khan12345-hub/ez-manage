import { Plus } from "lucide-react";
import { BoardHeader } from "./BoardHeader/BoardHeader";
import { Group } from "./group/Group";
import { Button } from "@/components/ui/button";
// interface Props {
//     board: BoardResponse;
// }

export function Board({ board }: any) {
    console.log("Groups", board.groups)
    return (
        <>
        <BoardHeader board={board}/>
        <div className="space-y-6 mb-4">
            {board.groups.map((group:any) => (
                <Group
                    key={group.id}
                    group={group}
                    columns={board.columns}
                />
            ))}
        </div>
        <Button
          type="button"
          variant="outline"
        //   onClick={onAddGroup}
          className="h-12 border-dashed justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add New Group
        </Button>

        </>
    );
}