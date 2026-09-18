import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import {
  AutomationActionType,
  AutomationTriggerType,
  BoardColumnType,
} from 'generated/prisma/enums';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(boardId: number, dto: CreateAutomationDto) {
    const { trigger, action } = dto;
    const data: any = {
      name: dto.name,
      boardId,
      triggerType: trigger.type,
      actionType: action.type,
    };

    // ── Trigger validation ──────────────────────────────────────────────────
    if (trigger.type === AutomationTriggerType.STATUS_CHANGED) {
      if (!trigger.columnId || !trigger.statusId) {
        throw new BadRequestException('STATUS_CHANGED trigger requires columnId and statusId');
      }
      const column = await this.prisma.boardColumn.findFirst({
        where: { id: trigger.columnId, boardId },
      });
      if (!column) throw new NotFoundException('Trigger column not found on this board');
      if (column.type !== BoardColumnType.STATUS)
        throw new BadRequestException('Trigger column must be a STATUS column');

      const status = await this.prisma.statusOption.findFirst({
        where: { id: trigger.statusId, columnId: trigger.columnId },
      });
      if (!status) throw new BadRequestException('Status does not belong to the trigger column');

      data.triggerColumnId = trigger.columnId;
      data.triggerStatusId = trigger.statusId;
    }

    if (trigger.type === AutomationTriggerType.DATE_ARRIVED) {
      const meta = trigger.metadata ?? {};
      if (!meta.dateColumnId) throw new BadRequestException('DATE_ARRIVED requires metadata.dateColumnId');
      data.triggerMetadata = meta;
    }

    // TASK_CREATED — no extra validation needed

    // ── Action validation ───────────────────────────────────────────────────
    if (action.type === AutomationActionType.MOVE_TO_GROUP) {
      if (!action.groupId) throw new BadRequestException('MOVE_TO_GROUP action requires groupId');
      const group = await this.prisma.group.findFirst({ where: { id: action.groupId, boardId } });
      if (!group) throw new BadRequestException('Target group does not belong to this board');
      data.targetGroupId = action.groupId;
    }

    if (action.type === AutomationActionType.NOTIFY_MEMBER) {
      const meta = action.metadata ?? {};
      const validTargets = ['board-members', 'creator', 'assignees'];
      const hasTarget = typeof meta.target === 'string' && validTargets.includes(meta.target as string);
      const hasUserIds = Array.isArray(meta.userIds) && (meta.userIds as number[]).length > 0;
      if (!hasTarget && !hasUserIds)
        throw new BadRequestException('NOTIFY_MEMBER requires metadata.target (board-members|creator|assignees) or metadata.userIds');
      data.actionMetadata = meta;
    }

    if (action.type === AutomationActionType.SEND_WHATSAPP) {
      const meta = action.metadata ?? {};
      const validTargets = ['board-members', 'creator', 'assignees'];
      const hasTarget = typeof meta.target === 'string' && validTargets.includes(meta.target as string);
      const hasUserIds = Array.isArray(meta.userIds) && (meta.userIds as number[]).length > 0;
      if (!hasTarget && !hasUserIds)
        throw new BadRequestException('SEND_WHATSAPP requires metadata.target (board-members|creator|assignees) or metadata.userIds');
      data.actionMetadata = meta;
    }

    if (action.type === AutomationActionType.ASSIGN_PERSON) {
      const meta = action.metadata ?? {};
      if (!meta.userId || !meta.columnId)
        throw new BadRequestException('ASSIGN_PERSON requires metadata.userId and metadata.columnId');
      data.actionMetadata = meta;
    }

    if (action.type === AutomationActionType.CHANGE_STATUS) {
      const meta = action.metadata ?? {};
      if (!meta.columnId || !meta.statusOptionId)
        throw new BadRequestException('CHANGE_STATUS requires metadata.columnId and metadata.statusOptionId');
      data.actionMetadata = meta;
    }

    if (action.type === AutomationActionType.CREATE_SUBITEM) {
      data.actionMetadata = action.metadata ?? { name: 'New subitem' };
    }

    if (action.type === AutomationActionType.SET_DATE) {
      const meta = action.metadata ?? {};
      if (!meta.columnId) throw new BadRequestException('SET_DATE requires metadata.columnId');
      data.actionMetadata = meta;
    }

    return this.prisma.automationRule.create({ data });
  }

  async findAll(boardId: number) {
    return this.prisma.automationRule.findMany({
      where: { boardId },
      include: {
        triggerColumn: true,
        triggerStatus: true,
        targetGroup: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(boardId: number, automationId: number, dto: UpdateAutomationDto) {
    const existing = await this.prisma.automationRule.findFirst({
      where: { id: automationId, boardId },
    });
    if (!existing) throw new NotFoundException('Automation not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    if (dto.trigger) {
      const { trigger } = dto;
      if (trigger.type) updateData.triggerType = trigger.type;

      if (trigger.type === AutomationTriggerType.STATUS_CHANGED || existing.triggerType === AutomationTriggerType.STATUS_CHANGED) {
        if (trigger.columnId !== undefined) updateData.triggerColumnId = trigger.columnId;
        if (trigger.statusId !== undefined) updateData.triggerStatusId = trigger.statusId;
      }

      if (trigger.metadata !== undefined) updateData.triggerMetadata = trigger.metadata;
    }

    if (dto.action) {
      const { action } = dto;
      if (action.type) updateData.actionType = action.type;
      if (action.groupId !== undefined) updateData.targetGroupId = action.groupId;
      if (action.metadata !== undefined) updateData.actionMetadata = action.metadata;
    }

    return this.prisma.automationRule.update({
      where: { id: automationId },
      data: updateData,
      include: {
        triggerColumn: true,
        triggerStatus: true,
        targetGroup: true,
      },
    });
  }

  async remove(boardId: number, id: number) {
    const automation = await this.prisma.automationRule.findFirst({ where: { id, boardId } });
    if (!automation) throw new NotFoundException('Automation not found');
    await this.prisma.automationRule.delete({ where: { id } });
    return { success: true };
  }

  async toggle(boardId: number, id: number) {
    const automation = await this.prisma.automationRule.findFirst({ where: { id, boardId } });
    if (!automation) throw new NotFoundException('Automation not found');
    return this.prisma.automationRule.update({
      where: { id },
      data: { isActive: !automation.isActive },
    });
  }
}
