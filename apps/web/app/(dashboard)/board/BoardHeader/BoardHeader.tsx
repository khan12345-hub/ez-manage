import { BoardTitle } from "./BoardTitle";
import { BoardToolbar } from "./BoardToolbar";

interface Props {
  board: any;
  onHideColumns: () => void;
}

export function BoardHeader({ board, onHideColumns }: Props) {
  return (
    <div className="bg-background">
      <div className="py-5">
        <BoardTitle board={board} />
      </div>

      <BoardToolbar
      onHideColumns={onHideColumns}
      />
    </div>
  );
}
