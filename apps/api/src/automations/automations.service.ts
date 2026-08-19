import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { AutomationActionType, AutomationTriggerType, BoardColumnType } from "generated/prisma/enums";

@Injectable()
export class AutomationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    boardId: number,
    dto: CreateAutomationDto,
  ) {
    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: dto.trigger.columnId,
        boardId,
      },
    });

    if (!column) {
      throw new NotFoundException(
        'Trigger column does not belong to this board',
      );
    }

    if (column.type !== BoardColumnType.STATUS) {
      throw new BadRequestException(
        'Automation trigger column must be a status column',
      );
    }

    const status = await this.prisma.statusOption.findFirst({
      where: {
        id: dto.trigger.statusId,
        columnId: dto.trigger.columnId,
      },
    });

    if (!status) {
      throw new BadRequestException(
        'Status does not belong to the trigger column',
      );
    }

    const group = await this.prisma.group.findFirst({
      where: {
        id: dto.action.groupId,
        boardId,
      },
    });

    if (!group) {
      throw new BadRequestException(
        'Target group does not belong to this board',
      );
    }

    return this.prisma.automationRule.create({
      data: {
        name: dto.name,
        boardId,

        triggerType: AutomationTriggerType.STATUS_CHANGED,
        actionType: AutomationActionType.MOVE_TO_GROUP,

        triggerColumnId: dto.trigger.columnId,
        triggerStatusId: dto.trigger.statusId,

        targetGroupId: dto.action.groupId,
      },
    });
  }

  async findAll(boardId: number) {
    return this.prisma.automationRule.findMany({
      where: {
        boardId,
      },
      include: {
        triggerColumn: true,
        triggerStatus: true,
        targetGroup: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async remove(boardId: number, id: number) {
    const automation = await this.prisma.automationRule.findFirst({
      where: {
        id,
        boardId,
      },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    await this.prisma.automationRule.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
    };
  }

  async toggle(boardId: number, id: number) {
    const automation = await this.prisma.automationRule.findFirst({
      where: {
        id,
        boardId,
      },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    return this.prisma.automationRule.update({
      where: {
        id,
      },
      data: {
        isActive: !automation.isActive,
      },
    });
  }
}