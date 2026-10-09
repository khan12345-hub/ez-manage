import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { NotificationsService } from './notifications.service';
import { NotificationStreamService } from './notification-stream.service';

import { TaskAssignedEvent } from './events/task-assigned.event';
import { CommentMentionedEvent } from './events/comment-mentioned.event';
import { CommentRepliedEvent } from './events/comment-replied.event';
import { WhatsappTaskUpdatedEvent } from '../whatsapp/whatsapp-task-updated.event';

@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationStreamService: NotificationStreamService,
  ) {}

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent) {
    try {
      if (event.recipientId === event.assignedById) return;

      const notification = await this.notificationsService.notify({
        recipientId: event.recipientId,
        type: 'TASK_ASSIGNED',
        title: 'You were assigned a task',
        message: `${event.assignedByName} assigned you to "${event.taskName}"`,
        entityType: 'TASK',
        entityId: event.taskId,
        metadata: {
          taskId: event.taskId,
          boardId: event.boardId,
          workspaceId: event.workspaceId,
          assignedById: event.assignedById,
        },
        eventKey: `task-assigned:${event.taskId}:${event.recipientId}`,
        sendEmail: true,
      });

      if (notification) {
        this.notificationStreamService.emit(event.recipientId, notification);
      }
    } catch (error) {
      console.error('[Notification Listener] Failed to process task assignment:', error);
    }
  }

  @OnEvent('comment.mentioned')
  async handleCommentMentioned(event: CommentMentionedEvent) {
    try {
      if (event.recipientId === event.mentionedById) return;

      const notification = await this.notificationsService.notify({
        recipientId: event.recipientId,
        type: 'COMMENT_MENTION',
        title: 'You were mentioned in a comment',
        message: `${event.mentionedByName} mentioned you in a comment on a task.`,
        entityType: 'COMMENT',
        entityId: event.commentId,
        metadata: {
          commentId: event.commentId,
          taskId: event.taskId,
          boardId: event.boardId,
          workspaceId: event.workspaceId,
          mentionedById: event.mentionedById,
          commentPreview: event.commentPreview,
        },
        eventKey: `comment-mentioned:${event.commentId}:${event.recipientId}`,
        sendEmail: true,
      });

      if (notification) {
        this.notificationStreamService.emit(event.recipientId, notification);
      }
    } catch (error) {
      console.error('[Notification Listener] Failed to process comment mention:', error);
    }
  }

  @OnEvent('comment.replied')
  async handleCommentReplied(event: CommentRepliedEvent) {
    try {
      if (event.data.recipientId === event.data.replyAuthorId) return;

      const notification = await this.notificationsService.notify({
        recipientId: event.data.recipientId,
        type: 'COMMENT_MENTION',
        title: 'Someone replied to your comment',
        message: `${event.data.replyAuthorName} replied to your comment on "${event.data.taskName}"`,
        entityType: 'COMMENT',
        entityId: event.data.commentId,
        metadata: {
          commentId: event.data.commentId,
          taskId: event.data.taskId,
          boardId: event.data.boardId,
          replyAuthorId: event.data.replyAuthorId,
        },
        eventKey: `comment-replied:${event.data.commentId}:${event.data.recipientId}`,
        sendEmail: true,
      });

      if (notification) {
        this.notificationStreamService.emit(event.data.recipientId, notification);
      }
    } catch (error) {
      console.error('[Notification Listener] Failed to process comment reply:', error);
    }
  }

  @OnEvent('whatsapp.task.updated')
  async handleWhatsappTaskUpdated(event: WhatsappTaskUpdatedEvent) {
    try {
      const members = await (this.notificationsService as any).prisma.boardMember.findMany({
        where: { boardId: event.boardId },
        select: { userId: true },
      });

      const recipientIds: number[] = members
        .map((m: any) => m.userId)
        .filter((id: number) => id !== event.actorUserId);

      for (const recipientId of recipientIds) {
        const notification = await this.notificationsService.notify({
          recipientId,
          type: 'TASK_ASSIGNED',
          title: 'Board updated via WhatsApp',
          message: event.description,
          entityType: 'TASK',
          entityId: event.taskId,
          metadata: { taskId: event.taskId, source: 'whatsapp' },
          eventKey: `whatsapp-update:${event.taskId}:${recipientId}`,
          sendEmail: false,
        });

        if (notification) {
          this.notificationStreamService.emit(recipientId, notification);
        }
      }
    } catch (err) {
      console.error('[Notification Listener] WhatsApp task update event failed:', err);
    }
  }
}
