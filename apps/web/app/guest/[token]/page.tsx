"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getGuestBoard } from "@/services/guest-access.api";
import { Loader2 } from "lucide-react";

type StatusOption = { id: number; label: string; color: string };
type Column = {
  id: number;
  name: string;
  type: string;
  order: number;
  isPrimary: boolean;
  statusOptions: StatusOption[];
};
type Cell = { columnId: number; value: any; column: { id: number; type: string } };
type Task = { id: number; name: string; cells: Cell[] };
type Group = { id: number; name: string; color: string; tasks: Task[] };
type GuestBoard = { id: number; name: string; columns: Column[]; groups: Group[] };

function CellValue({ value, column }: { value: any; column: Column }) {
  if (value === null || value === undefined) return null;

  switch (column.type) {
    case "TEXT":
      return <span>{value?.text ?? (typeof value === "string" ? value : "")}</span>;

    case "NUMBER":
      return <span>{value?.number ?? (typeof value === "number" ? value : "")}</span>;

    case "CHECKBOX":
      return <span>{value?.checked ? "✓" : ""}</span>;

    case "DATE":
      return <span>{value?.date ? new Date(value.date).toLocaleDateString("en-CA") : ""}</span>;

    case "TIMELINE":
      if (value?.startDate && value?.endDate)
        return <span>{value.startDate} – {value.endDate}</span>;
      return <span>{value?.startDate ?? value?.endDate ?? ""}</span>;

    case "STATUS": {
      const label = typeof value === "string" ? value : value?.label ?? "";
      const color =
        value?.color ??
        column.statusOptions.find((o) => o.label.toLowerCase() === label.toLowerCase())?.color ??
        "#94a3b8";
      return (
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      );
    }

    case "PERSON": {
      const users: { firstName?: string; lastName?: string; name?: string }[] =
        Array.isArray(value?.users) ? value.users : [];
      return (
        <span>
          {users.map((u) => u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()).join(", ")}
        </span>
      );
    }

    default:
      return <span>{typeof value === "string" ? value : ""}</span>;
  }
}

export default function GuestBoardPage() {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<GuestBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getGuestBoard(token)
      .then(setBoard)
      .catch(() => setError("This link is invalid or has been revoked."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-lg font-semibold text-slate-700">Link not found</p>
        <p className="text-sm text-slate-500">{error ?? "This guest link is unavailable."}</p>
      </div>
    );
  }

  const extraColumns = board.columns.filter((c) => !c.isPrimary);
  const columnMap = new Map(board.columns.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-0.5 font-medium tracking-wide uppercase">Board</p>
          <h1 className="text-xl font-semibold text-slate-800">{board.name}</h1>
        </div>
        <span className="text-xs text-slate-400">Powered by EzManage · View only</span>
      </header>

      {/* Board content */}
      <main className="px-4 py-6 space-y-8 overflow-x-auto">
        {board.groups.map((group) => (
          <section key={group.id}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: group.color ?? "#94a3b8" }}
              />
              <span className="text-sm font-semibold text-slate-700">{group.name}</span>
              <span className="text-xs text-slate-400">({group.tasks.length})</span>
            </div>

            {/* Tasks table */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500 w-64">
                      Task
                    </th>
                    {extraColumns.map((col) => (
                      <th
                        key={col.id}
                        className="text-left py-2 px-4 text-xs font-semibold text-slate-500 min-w-[120px]"
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.tasks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={1 + extraColumns.length}
                        className="py-4 px-4 text-center text-xs text-slate-400"
                      >
                        No tasks
                      </td>
                    </tr>
                  ) : (
                    group.tasks.map((task, i) => {
                      const cellMap = new Map(task.cells.map((c) => [c.columnId, c]));
                      return (
                        <tr
                          key={task.id}
                          className={
                            i !== group.tasks.length - 1
                              ? "border-b border-slate-100"
                              : ""
                          }
                        >
                          <td className="py-2 px-4 font-medium text-slate-800 text-sm">
                            {task.name}
                          </td>
                          {extraColumns.map((col) => {
                            const cell = cellMap.get(col.id);
                            return (
                              <td key={col.id} className="py-2 px-4 text-slate-600 text-xs">
                                {cell?.value != null ? (
                                  <CellValue value={cell.value} column={col} />
                                ) : (
                                  ""
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {board.groups.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-16">This board has no groups yet.</p>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-slate-400">
        © EzManage · This is a read-only view shared by the board owner.
      </footer>
    </div>
  );
}
