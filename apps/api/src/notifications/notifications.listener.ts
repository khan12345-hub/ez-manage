// import { Injectable } from '@nestjs/common';
// import { OnEvent } from '@nestjs/event-emitter';

import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "./notifications.service";
import { NotificationStreamService } from "./notification-stream.service";
import { TaskAssignedEvent } from "./events/task-assigned.event";

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notificationsService: NotificationsService,

    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  @OnEvent('task.assigned')
  async handleTaskAssigned(
    event: any,
  ) {
    console.log(
      '[Notification Listener] Task assigned event received:',
      event,
    );

    try {
      console.log(
        '[Notification Listener] Creating notification for user:',
        event.recipientId,
      );

      const notification =
        await this.notificationsService.notify({
          recipientId: event.recipientId,

          type: 'TASK_ASSIGNED',

          title: 'You were assigned a task',

          message:
            `${event.assignedByName} assigned you to "${event.taskName}"`,

          entityType: 'TASK',

          entityId: event.taskId,

          metadata: {
            taskId: event.taskId,

            boardId: event.boardId,

            assignedById: event.assignedById,
          },

          eventKey:
            `task-assigned:${event.taskId}:${event.recipientId}`,

          sendEmail: true,
        });

      console.log(
        '[Notification Listener] Notification created successfully:',
        notification,
      );

      console.log(
        '[Notification Listener] Sending notification through SSE:',
        {
          recipientId: event.recipientId,

          notificationId: notification.id,
        },
      );

      this.notificationStreamService.emit(
        event.recipientId,

        notification,
      );

      console.log(
        '[Notification Listener] SSE notification emitted successfully',
      );
    } catch (error) {
      console.error(
        '[Notification Listener] Failed to process notification:',
        error,
      );
    }
  }
}





