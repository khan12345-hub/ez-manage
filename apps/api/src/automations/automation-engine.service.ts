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
  statusId: number,
) {
  console.log("[Automation] Checking automation rules:", {
    taskId,
    boardId,
    columnId,
    statusId,
  });

  const automations =
    await this.prisma.automationRule.findMany({
      where: {
        boardId,

        isActive: true,

        triggerType:
          AutomationTriggerType.STATUS_CHANGED,

        triggerColumnId: columnId,

        triggerStatusId: statusId,

        actionType:
          AutomationActionType.MOVE_TO_GROUP,
      },
    });

  console.log(
    "[Automation] Matching rules:",
    automations,
  );

  for (const automation of automations) {
    if (!automation.targetGroupId) {
      console.warn(
        "[Automation] Automation has no target group:",
        automation.id,
      );

      continue;
    }

    console.log(
      "[Automation] Moving task:",
      {
        taskId,
        automationId: automation.id,
        targetGroupId:
          automation.targetGroupId,
      },
    );

    const updatedTask =
      await this.prisma.task.update({
        where: {
          id: taskId,
        },
        data: {
          groupId:
            automation.targetGroupId,
        },
      });

    console.log(
      "[Automation] Task moved successfully:",
      {
        taskId: updatedTask.id,
        newGroupId:
          updatedTask.groupId,
      },
    );
  }
}
}
