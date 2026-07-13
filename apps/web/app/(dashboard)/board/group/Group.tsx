import { Plus } from "lucide-react";
import { Headers } from "./columns/Headers";
import { TaskRow } from "./TaskRow";
import { useState } from "react";
import { ColumnTypeModal } from "./columns/AddColumnModal";

interface Props {
  // group: Group;
  // columns: Column[];
  group: any;
  columns: any;
}
export function Group({ group, columns }: Props) {
  console.log("columns", columns);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted px-4 py-3 font-semibold">{group.name}</div>

        <table className="w-full">
          <thead>
            <tr>
              {columns.map((column: any) => (
                <Headers key={column.id} column={column} />
              ))}
              <div
                onClick={() => setOpen(true)}
                className="cursor-pointer w-44 flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Column
              </div>
            </tr>
          </thead>

          <tbody>
            {group.tasks.map((task: any) => (
              <TaskRow key={task.id} task={task} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
      <ColumnTypeModal
        open={open}
        onOpenChange={setOpen}
        onSelect={(type) => {
          console.log(type);
          // Create column API
        }}
      />
    </>
  );
}
