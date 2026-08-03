import {
  Injectable,
} from "@nestjs/common";

import {
  OnEvent,
} from "@nestjs/event-emitter";

// import {
//   NotificationEntityType,
//   NotificationType,
// } from "@prisma/client";

import { NotificationsService } from "./notifications.service";

import { TaskAssignedEvent } from "./events/task-assigned.event";

import { CommentMentionedEvent } from "./events/comment-mentioned.event";

import { CommentRepliedEvent } from "./events/comment-replied.event";
import { NotificationEntityType, NotificationType } from "generated/prisma/client";

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notificationsService:
      NotificationsService,
  ) {}

  @OnEvent("task.assigned")
  async handleTaskAssigned(
    event: TaskAssignedEvent,
  ) {
    const {
      recipientId,
      taskId,
      boardId,
      taskName,
      assignedById,
      assignedByName,
    } = event.data;

    await this.notificationsService.notify({
      recipientId,

      type:
        NotificationType.TASK_ASSIGNED,

      title:
        "You were assigned a task",

      message:
        `${assignedByName} assigned you to "${taskName}"`,

      entityType:
        NotificationEntityType.TASK,

      entityId: taskId,

      metadata: {
        taskId,

        boardId,

        assignedById,
      },

      eventKey:
        `task-assigned:${taskId}:${recipientId}`,

      sendEmail: true,
    });
  }

  @OnEvent("comment.mentioned")
  async handleCommentMentioned(
    event: CommentMentionedEvent,
  ) {
    const {
      recipientId,
      commentId,
      taskId,
      boardId,
      taskName,
      commentAuthorId,
      commentAuthorName,
    } = event.data;

    await this.notificationsService.notify({
      recipientId,

      type:
        NotificationType.COMMENT_MENTION,

      title:
        "You were mentioned in a comment",

      message:
        `${commentAuthorName} mentioned you in a comment on "${taskName}"`,

      entityType:
        NotificationEntityType.COMMENT,

      entityId: commentId,

      metadata: {
        commentId,

        taskId,

        boardId,

        commentAuthorId,
      },

      eventKey:
        `comment-mention:${commentId}:${recipientId}`,

      sendEmail: true,
    });
  }

  @OnEvent("comment.replied")
  async handleCommentReplied(
    event: CommentRepliedEvent,
  ) {
    const {
      recipientId,
      commentId,
      taskId,
      boardId,
      taskName,
      replyAuthorId,
      replyAuthorName,
    } = event.data;

    await this.notificationsService.notify({
      recipientId,

      type:
        NotificationType.COMMENT_REPLY,

      title:
        "Someone replied to your comment",

      message:
        `${replyAuthorName} replied to your comment on "${taskName}"`,

      entityType:
        NotificationEntityType.COMMENT,

      entityId: commentId,

      metadata: {
        commentId,

        taskId,

        boardId,

        replyAuthorId,
      },

      eventKey:
        `comment-reply:${commentId}:${replyAuthorId}`,
    });
  }
}