import { TextCell } from "./TextCell";
import { PriorityCell } from "./PriorityCell";
import { PersonCell } from "./PersonCell";
import { DateCell } from "./DateCell";
import { StatusCell } from "./StatusCell";

interface CellProps {
  column: any;
  task: any;
}

export function Cell({ column, task }: CellProps) {
  const cell = task.cells.find(
    (item: any) => item.columnId === column.id,
  );

  switch (column.type) {
    case "TEXT":
      return (
        <td className="border px-3 py-2">
          <TextCell cell={cell} />
        </td>
      );

    case "STATUS":
      return (
        <td className="border px-3 py-2">
          <StatusCell cell={cell} />
        </td>
      );

    case "PRIORITY":
      return (
        <td className="border px-3 py-2">
          <PriorityCell cell={cell} />
        </td>
      );

    case "PERSON":
      return (
        <td className="border px-3 py-2">
          <PersonCell cell={cell} />
        </td>
      );

    case "DATE":
      return (
        <td className="border px-3 py-2">
          <DateCell cell={cell} />
        </td>
      );

    default:
      return (
        <td className="border px-3 py-2 text-muted-foreground">
          —
        </td>
      );
  }
}