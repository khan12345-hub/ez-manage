export class TaskAssignedEvent {
  recipientId: number;
  taskId: number;
  boardId: number;
  workspaceId: number;
  taskName: string;
  assignedById: number;
  assignedByName: string;

  constructor(params: {
    recipientId: number;
    taskId: number;
    boardId: number;
    workspaceId: number;
    taskName: string;
    assignedById: number;
    assignedByName: string;
  }) {
    this.recipientId = params.recipientId;
    this.taskId = params.taskId;
    this.boardId = params.boardId;
    this.workspaceId = params.workspaceId;
    this.taskName = params.taskName;
    this.assignedById = params.assignedById;
    this.assignedByName = params.assignedByName;
  }
}