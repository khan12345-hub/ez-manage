import { Cell } from "../Cells/Cell";

interface Props {
  // task: Task;
  // columns: Column[];
  task: any;
  columns: any;
}
export function TaskRow({ task, columns }: Props) {
  return (
    <tr>
      {columns.map((column:any) => (
        <Cell key={column.id} column={column} task={task} />
      ))}
       <td className="w-14 border border-gray-200" />
    </tr>
  );
}
