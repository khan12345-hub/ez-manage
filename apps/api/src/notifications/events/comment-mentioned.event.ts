export class CommentMentionedEvent {
  constructor(
    public readonly data: {
      recipientId: number;
      commentId: number;
      taskId: number;
      boardId: number;
      taskName: string;
      commentAuthorId: number;
      commentAuthorName: string;
    },
  ) {}
}