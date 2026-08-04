import { TaskActivityFeed } from "./TaskActivityFeed";

interface ActivityTabProps {
  task: any;
}

export function ActivityTab({ task }: ActivityTabProps) {
  return (
    <div>{task && <TaskActivityFeed taskId={task.id} />}</div>
  );
}
