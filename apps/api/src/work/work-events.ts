/** Task events that automations react to (emitted by WorkService). */
export const WORK_TASK_EVENT = 'work.task.event';

export interface WorkTaskEvent {
  type: 'task_created' | 'status_changed' | 'assignee_added' | 'priority_changed' | 'due_date_changed' | 'comment_added' | 'task_moved';
  taskId: number;
  actorId: number;
  from?: string | null;
  to?: string | null;
  userIds?: number[];
}
