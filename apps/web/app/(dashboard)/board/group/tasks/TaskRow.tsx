import { Checkbox } from "@/components/ui/checkbox";
import { Cell } from "../../Cells/Cell";

interface Props {
  // task: Task;
  // columns: Column[];
  task: any;
  columns: any;
  color: string;
}
export function TaskRow({ task, columns, color }: Props) {
  console.table(
  columns.map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    order: c.order,
  }))
);
  return (
    <>
      <tr>
        <td style={{ backgroundColor: color }} className="w-1 sticky left-0" />
        <td className="w-2"><Checkbox/></td>
        {columns.map((column: any) => (
          <Cell key={column.id} column={column} task={task} />
        ))}
        
      </tr>
    </>
  );
}
