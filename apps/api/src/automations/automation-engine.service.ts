import { Injectable } from '@nestjs/common';
import {
  AutomationActionType,
  AutomationTriggerType,
} from 'generated/prisma/enums';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AutomationEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async handleStatusChanged(
    taskId: number,
    boardId: number,
    columnId: number,
    newStatusId: number,
  ) {
    const automations = await this.prisma.automationRule.findMany({
      where: {
        boardId,
        isActive: true,
        triggerType: AutomationTriggerType.STATUS_CHANGED,
        triggerColumnId: columnId,
        triggerStatusId: newStatusId,
        actionType: AutomationActionType.MOVE_TO_GROUP,
      },
    });

    for (const automation of automations) {
      if (!automation.targetGroupId) {
        continue;
      }

      await this.prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          groupId: automation.targetGroupId,
        },
      });
    }
  }
}
