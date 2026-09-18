export class WhatsappTaskUpdatedEvent {
  constructor(
    public readonly taskId: number,
    public readonly boardId: number,
    public readonly actorUserId: number,
    public readonly description: string,
  ) {}
}
