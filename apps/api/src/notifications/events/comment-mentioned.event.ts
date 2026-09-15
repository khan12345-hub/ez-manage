export class CommentMentionedEvent {
  recipientId: number;
  commentId: number;
  taskId: number;
  boardId: number;
  workspaceId: number;
  commentPreview: string;
  mentionedById: number;
  mentionedByName: string;

  constructor(params: {
    recipientId: number;
    commentId: number;
    taskId: number;
    boardId: number;
    workspaceId: number;
    commentPreview: string;
    mentionedById: number;
    mentionedByName: string;
  }) {
    this.recipientId = params.recipientId;
    this.commentId = params.commentId;
    this.taskId = params.taskId;
    this.boardId = params.boardId;
    this.workspaceId = params.workspaceId;
    this.commentPreview = params.commentPreview;
    this.mentionedById = params.mentionedById;
    this.mentionedByName = params.mentionedByName;
  }
}
