"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { columns, Board } from "./columns";

interface Props {
  boards: Board[];
}

export function BoardTable({ boards }: Props) {
  const table = useReactTable({
    data: boards,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border bg-background">

      {/* Horizontal Scroll */}

      <div className="overflow-x-auto">

        <table className="min-w-[1200px] border-collapse">

          <thead className="bg-muted/50">

            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>

                {headerGroup.headers.map((header, index) => (
                  <th
                    key={header.id}
                    className={`
                      border-b
                      px-5
                      py-4
                      text-left
                      font-semibold

                      ${
                        index === 0
                          ? "sticky left-0 z-30 bg-background min-w-[300px]"
                          : "min-w-[180px]"
                      }
                    `}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}

              </tr>
            ))}

          </thead>

          <tbody>

            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-muted/40"
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    key={cell.id}
                    className={`
                      border-b
                      px-5
                      py-5

                      ${
                        index === 0
                          ? "sticky left-0 z-20 bg-background min-w-[300px]"
                          : "min-w-[180px]"
                      }
                    `}
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}

          </tbody>

        </table>

      </div>
    </div>
  );
}