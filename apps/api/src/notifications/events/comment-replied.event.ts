export class CommentRepliedEvent {
  constructor(
    public readonly data: {
      recipientId: number;
      commentId: number;
      taskId: number;
      boardId: number;
      taskName: string;
      replyAuthorId: number;
      replyAuthorName: string;
    },
  ) {}
}