"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { createColumns, Board } from "./columns";
import { EditBoardModal } from "@/components/EditBoardModal";

interface Props {
  boards: Board[];
  workspaceId: number;
}

export function BoardTable({ boards, workspaceId }: Props) {
  const router = useRouter();
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);

  const columns = useMemo(
    () =>
      createColumns(
        (board) => router.push(`/workspace/${workspaceId}/board/${board.id}`),
        setEditingBoard,
      ),
    [workspaceId, router],
  );

  const table = useReactTable({
    data: boards,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => (
                    <th
                      key={header.id}
                      className={`
                        border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground
                        ${index === 0 ? "sticky left-0 z-30 bg-muted/50 w-[40%] min-w-[200px]" : ""}
                        ${index === 1 ? "hidden sm:table-cell" : ""}
                        ${index === 3 ? "hidden md:table-cell" : ""}
                        ${index === 5 ? "w-10" : ""}
                      `}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-muted/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell, index) => (
                    <td
                      key={cell.id}
                      className={`
                        border-b px-4 py-4 text-sm
                        ${index === 0 ? "sticky left-0 z-20 bg-background group-hover:bg-muted/40 w-[40%] min-w-[200px] transition-colors" : ""}
                        ${index === 1 ? "hidden sm:table-cell text-muted-foreground" : ""}
                        ${index === 3 ? "hidden md:table-cell text-muted-foreground" : ""}
                        ${index === 5 ? "w-10 pr-2" : ""}
                        ${index > 0 && index !== 1 && index !== 3 && index !== 5 ? "text-muted-foreground" : ""}
                      `}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingBoard && (
        <EditBoardModal
          isOpen={true}
          onClose={() => setEditingBoard(null)}
          workspaceId={workspaceId}
          boardId={editingBoard.id}
          initialName={editingBoard.name}
          initialVisibility={editingBoard.visibility as "PUBLIC" | "PRIVATE"}
        />
      )}
    </>
  );
}
