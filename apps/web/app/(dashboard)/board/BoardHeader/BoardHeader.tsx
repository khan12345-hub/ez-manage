import { BoardTitle } from "./BoardTitle";
import { BoardToolbar } from "./BoardToolbar";

interface Props {
  board: any;
}

export function BoardHeader({ board }: Props) {
  return (
    <div className="bg-background">
      <div className="py-5">
        <BoardTitle board={board} />
      </div>

      <BoardToolbar />
    </div>
  );
}