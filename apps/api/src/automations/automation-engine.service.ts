import { Injectable, Optional } from '@nestjs/common';
import {
  AutomationActionType,
  AutomationTriggerType,
  NotificationEntityType,
  NotificationType,
} from 'generated/prisma/enums';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationStreamService } from '../notifications/notification-stream.service';

@Injectable()
export class AutomationEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService: NotificationsService,
    @Optional() private readonly notificationStreamService: NotificationStreamService,
  ) {}

  // ── STATUS_CHANGED trigger ──────────────────────────────────────────────────
  async handleStatusChanged(
    taskId: number,
    boardId: number,
    columnId: number,
    statusId: number,
  ) {
    const automations = await this.prisma.automationRule.findMany({
      where: {
        boardId,
        isActive: true,
        triggerType: AutomationTriggerType.STATUS_CHANGED,
        triggerColumnId: columnId,
        triggerStatusId: statusId,
      },
    });

    for (const automation of automations) {
      await this.executeAction(automation, taskId, boardId);
    }

    if (automations.length > 0) {
      await this.emitBoardUpdate(boardId);
    }
  }

  // ── TASK_CREATED trigger ────────────────────────────────────────────────────
  async handleTaskCreated(taskId: number, boardId: number) {
    const automations = await this.prisma.automationRule.findMany({
      where: {
        boardId,
        isActive: true,
        triggerType: AutomationTriggerType.TASK_CREATED,
      },
    });

    for (const automation of automations) {
      await this.executeAction(automation, taskId, boardId);
    }

    if (automations.length > 0) {
      await this.emitBoardUpdate(boardId);
    }
  }

  // ── DATE_ARRIVED trigger — called by a cron job ─────────────────────────────
  async handleDateArrived(boardId: number, dateColumnId: number, taskId: number) {
    const automations = await this.prisma.automationRule.findMany({
      where: {
        boardId,
        isActive: true,
        triggerType: AutomationTriggerType.DATE_ARRIVED,
      },
    });

    let ran = false;
    for (const automation of automations) {
      const meta = automation.triggerMetadata as any;
      if (meta?.dateColumnId !== dateColumnId) continue;
      await this.executeAction(automation, taskId, boardId);
      ran = true;
    }

    if (ran) {
      await this.emitBoardUpdate(boardId);
    }
  }

  // ── Action executor ─────────────────────────────────────────────────────────
  private async executeAction(automation: any, taskId: number, boardId: number) {
    try {
      switch (automation.actionType as AutomationActionType) {
        case AutomationActionType.MOVE_TO_GROUP:
          await this.actionMoveToGroup(automation, taskId);
          break;

        case AutomationActionType.NOTIFY_MEMBER:
          await this.actionNotifyMember(automation, taskId, boardId);
          break;

        case AutomationActionType.ASSIGN_PERSON:
          await this.actionAssignPerson(automation, taskId, boardId);
          break;

        case AutomationActionType.CHANGE_STATUS:
          await this.actionChangeStatus(automation, taskId, boardId);
          break;

        case AutomationActionType.CREATE_SUBITEM:
          await this.actionCreateSubitem(automation, taskId);
          break;

        case AutomationActionType.SET_DATE:
          await this.actionSetDate(automation, taskId, boardId);
          break;

        case AutomationActionType.SEND_WHATSAPP:
          await this.actionSendWhatsapp(automation, taskId, boardId);
          break;
      }
    } catch (err) {
      console.error(`[Automation] Error executing action ${automation.actionType} for rule ${automation.id}:`, err);
    }
  }

  // ── MOVE_TO_GROUP ──────────────────────────────────────────────────────────
  private async actionMoveToGroup(automation: any, taskId: number) {
    if (!automation.targetGroupId) return;
    await this.prisma.task.update({
      where: { id: taskId },
      data: { groupId: automation.targetGroupId },
    });
  }

  // ── NOTIFY_MEMBER ──────────────────────────────────────────────────────────
  private async actionNotifyMember(automation: any, taskId: number, boardId: number) {
    const meta = automation.actionMetadata as any;
    let userIds: number[] = Array.isArray(meta?.userIds) ? meta.userIds : [];

    if (userIds.length === 0 && (meta?.target === 'board-members' || meta?.target === 'creator')) {
      if (meta.target === 'board-members') {
        const members = await this.prisma.boardMember.findMany({
          where: { boardId },
          select: { userId: true },
        });
        userIds = members.map((m) => m.userId);
      } else if (meta.target === 'creator') {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { createdById: true },
        });
        if (task?.createdById) userIds = [task.createdById];
      }
    }

    if (userIds.length === 0) return;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true },
    });

    const title   = `Automation: ${automation.name}`;
    const message = `Automation triggered on task "${task?.name ?? 'Unknown'}"`;

    for (const userId of userIds) {
      if (this.notificationsService) {
        // Uses NotificationsService so the WhatsApp hook fires automatically
        await this.notificationsService.notify({
          recipientId: userId,
          type: NotificationType.AUTOMATION,
          title,
          message,
          entityType: NotificationEntityType.TASK,
          entityId: taskId,
          metadata: { boardId },
          sendEmail: false,
        }).catch((err: unknown) => {
          console.error('[Automation] Failed to notify:', err);
        });
      } else {
        // Fallback (WhatsappModule context — no NotificationsService available)
        await this.prisma.notification.create({
          data: {
            recipientId: userId,
            type: NotificationType.AUTOMATION,
            title,
            message,
            entityType: NotificationEntityType.TASK,
            entityId: taskId,
            metadata: { boardId },
            isRead: false,
          },
        }).catch((err: unknown) => {
          console.error('[Automation] Failed to create notification:', err);
        });
      }
    }
  }

  // ── SEND_WHATSAPP ──────────────────────────────────────────────────────────
  private async actionSendWhatsapp(automation: any, taskId: number, boardId: number) {
    const meta = automation.actionMetadata as any;
    let userIds: number[] = Array.isArray(meta?.userIds) ? meta.userIds : [];

    // Resolve target
    if (userIds.length === 0) {
      if (meta?.target === 'board-members') {
        const members = await this.prisma.boardMember.findMany({
          where: { boardId },
          select: { userId: true },
        });
        userIds = members.map((m) => m.userId);
      } else if (meta?.target === 'creator') {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { createdById: true },
        });
        if (task?.createdById) userIds = [task.createdById];
      } else if (meta?.target === 'assignees') {
        const cells = await this.prisma.taskCell.findMany({
          where: {
            taskId,
            column: { type: 'PERSON' },
          },
          select: { value: true },
        });
        for (const cell of cells) {
          const users = (cell.value as any)?.users ?? [];
          userIds.push(...users.map((u: any) => u.id));
        }
        userIds = [...new Set(userIds)];
      }
    }

    if (userIds.length === 0) return;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true },
    });

    const customMessage: string = meta?.message?.trim()
      ? meta.message
      : `📋 Automation: ${automation.name}\nTask: "${task?.name ?? 'Unknown'}"`;

    for (const userId of userIds) {
      await this.sendWhatsappDirect(userId, customMessage);
    }
  }

  // Inline WhatsApp send — avoids circular dep with WhatsappService
  private async sendWhatsappDirect(userId: number, message: string) {
    const phoneId = process.env.WHATSAPP_PHONE_ID ?? '';
    const token   = process.env.WHATSAPP_TOKEN ?? '';
    if (!phoneId || !token) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappPhone: true, whatsappEnabled: true, whatsappOnAutomation: true },
    });
    if (!user?.whatsappEnabled || !user.whatsappPhone || user.whatsappOnAutomation === false) return;

    try {
      await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: user.whatsappPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      });

      await this.prisma.whatsappLog.create({
        data: { userId, direction: 'OUT', body: message, status: 'sent' },
      }).catch(() => {});
    } catch (err) {
      console.error('[Automation] WhatsApp send failed:', err);
    }
  }

  // ── ASSIGN_PERSON ──────────────────────────────────────────────────────────
  private async actionAssignPerson(automation: any, taskId: number, boardId: number) {
    const meta = automation.actionMetadata as any;
    if (!meta?.userId || !meta?.columnId) return;

    const cell = await this.prisma.taskCell.findFirst({
      where: { taskId, columnId: meta.columnId as number },
    });
    if (!cell) return;

    const current = (cell.value as any)?.users ?? [];
    const alreadyAssigned = current.some((u: any) => u.id === meta.userId);
    if (alreadyAssigned) return;

    const user = await this.prisma.user.findUnique({
      where: { id: meta.userId as number },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    if (!user) return;

    await this.prisma.taskCell.update({
      where: { id: cell.id },
      data: { value: { users: [...current, user] } },
    });
  }

  // ── CHANGE_STATUS ──────────────────────────────────────────────────────────
  private async actionChangeStatus(automation: any, taskId: number, boardId: number) {
    const meta = automation.actionMetadata as any;
    if (!meta?.columnId || !meta?.statusOptionId) return;

    const [cell, statusOption] = await Promise.all([
      this.prisma.taskCell.findFirst({
        where: { taskId, columnId: meta.columnId as number },
      }),
      this.prisma.statusOption.findUnique({
        where: { id: meta.statusOptionId as number },
      }),
    ]);

    if (!cell || !statusOption) return;

    await this.prisma.taskCell.update({
      where: { id: cell.id },
      data: {
        value: {
          id: statusOption.id,
          label: statusOption.label,
          color: statusOption.color,
        },
      },
    });
  }

  // ── CREATE_SUBITEM ─────────────────────────────────────────────────────────
  private async actionCreateSubitem(automation: any, taskId: number) {
    const meta = automation.actionMetadata as any;
    const subitemName = (meta?.name as string | undefined) ?? 'Auto subitem';

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { groupId: true, createdById: true },
    });
    if (!task) return;

    const lastSubtask = await this.prisma.task.findFirst({
      where: { parentId: taskId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (lastSubtask?.order ?? 0) + 1000;

    await this.prisma.task.create({
      data: {
        name: subitemName,
        groupId: task.groupId,
        parentId: taskId,
        order,
        createdById: task.createdById,
      },
    });
  }

  // ── SET_DATE ───────────────────────────────────────────────────────────────
  private async actionSetDate(automation: any, taskId: number, boardId: number) {
    const meta = automation.actionMetadata as any;
    if (!meta?.columnId) return;

    const cell = await this.prisma.taskCell.findFirst({
      where: { taskId, columnId: meta.columnId as number },
    });
    if (!cell) return;

    const offsetDays = (meta.offsetDays as number | undefined) ?? 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + offsetDays);

    await this.prisma.taskCell.update({
      where: { id: cell.id },
      data: { value: { date: targetDate.toISOString() } },
    });
  }

  // ── Board update SSE broadcast ─────────────────────────────────────────────
  private async emitBoardUpdate(boardId: number) {
    if (!this.notificationStreamService) return;
    try {
      const members = await this.prisma.boardMember.findMany({
        where: { boardId },
        select: { userId: true },
      });
      for (const { userId } of members) {
        this.notificationStreamService.emitRaw(userId, 'board_update', { boardId });
      }
    } catch {
      // Non-critical — board will update on next manual refresh if this fails
    }
  }
}
