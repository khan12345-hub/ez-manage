export class TaskAssignedEvent {
  constructor(
    public readonly data: {
      recipientId: number;
      taskId: number;
      boardId: number;
      taskName: string;
      assignedById: number;
      assignedByName: string;
    },
  ) {}
}