import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';

import { TaskAssignedEvent } from './events/task-assigned.event';
import { CommentMentionedEvent } from './events/comment-mentioned.event';

@Injectable()
export class NotificationsListener {
constructor(
private readonly notificationsService: NotificationsService,


private readonly notificationStreamService: NotificationStreamService,


) {
console.log(
'🔥 NotificationsListener INITIALIZED',
);
}

/**

* Task assignment notification
  */
  @OnEvent('task.assigned')
  async handleTaskAssigned(
  event: TaskAssignedEvent,
  ) {
  console.log(
  '[Notification Listener] Task assigned event received:',
  event,
  );


try {



  /**
   * Do not notify when user assigns
   * the task to themselves.
   */
  if (
    event.recipientId ===
    event.assignedById
  ) {
    console.log(
      '[Notification Listener] Skipping self-assignment notification',
    );

    return;
  }

  const notification =
    await this.notificationsService.notify({
      recipientId:
        event.recipientId,

      type:
        'TASK_ASSIGNED',

      title:
        'You were assigned a task',

      message:
        `${event.assignedByName} assigned you to "${event.taskName}"`,

      entityType:
        'TASK',

      entityId:
        event.taskId,

      metadata: {
        taskId:
          event.taskId,

        boardId:
          event.boardId,

        assignedById:
          event.assignedById,
      },

      eventKey:
        `task-assigned:${event.taskId}:${event.recipientId}`,

      sendEmail: true,
    });

  /**
   * Send real-time notification
   * to connected SSE clients.
   */
  this.notificationStreamService.emit(
    event.recipientId,
    notification,
  );

  console.log(
    '[Notification Listener] Task assignment notification sent',
    {
      recipientId:
        event.recipientId,

      notificationId:
        notification.id,
    },
  );
} catch (error) {
  console.error(
    '[Notification Listener] Failed to process task assignment:',
    error,
  );
}


}

/**

* Comment mention notification
  */
  @OnEvent('comment.mentioned')
  async handleCommentMentioned(
  event: CommentMentionedEvent,
  ) {
  console.log(
  '[Notification Listener] Comment mention event received:',
  event,
  );


try {



  /**
   * Do not notify when user mentions
   * themselves.
   */
  if (
    event.recipientId ===
    event.mentionedById
  ) {
    console.log(
      '[Notification Listener] Skipping self-mention notification',
    );

    return;
  }

  const notification =
    await this.notificationsService.notify({
      recipientId:
        event.recipientId,

      type:
        'COMMENT_MENTION',

      title:
        'You were mentioned in a comment',

      message:
        `${event.mentionedByName} mentioned you in a comment on a task.`,

      entityType:
        'COMMENT',

      entityId:
        event.commentId,

      metadata: {
        commentId:
          event.commentId,

        taskId:
          event.taskId,

        boardId:
          event.boardId,

        mentionedById:
          event.mentionedById,

        commentPreview:
          event.commentPreview,
      },

      eventKey:
        `comment-mentioned:${event.commentId}:${event.recipientId}`,

      sendEmail: true,
    });

  /**
   * Send real-time notification
   * through SSE.
   */
  this.notificationStreamService.emit(
    event.recipientId,

    notification,
  );

  console.log(
    '[Notification Listener] Comment mention notification sent',
    {
      recipientId:
        event.recipientId,

      notificationId:
        notification.id,
    },
  );
} catch (error) {
  console.error(
    '[Notification Listener] Failed to process comment mention:',
    error,
  );
}


}
}
