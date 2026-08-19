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

  async update(
    boardId: number,
    automationId: number,
    dto: UpdateAutomationDto,
  ) {
    const automation = await this.prisma.automationRule.findFirst({
      where: {
        id: automationId,
        boardId,
      },
    });

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    // Validate trigger column if it is being updated
    if (dto.trigger?.columnId !== undefined) {
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
    }

    

    // Validate status if either column or status is being updated
    if (
      dto.trigger?.columnId !== undefined ||
      dto.trigger?.statusId !== undefined
    ) {
      const statusId = dto.trigger?.statusId ?? automation.triggerStatusId;

      if (
        dto.trigger?.columnId !== undefined ||
        dto.trigger?.statusId !== undefined
      ) {
        const triggerColumnId =
          dto.trigger?.columnId ?? automation.triggerColumnId;

        const statusId = dto.trigger?.statusId ?? automation.triggerStatusId;

        if (triggerColumnId === null) {
          throw new BadRequestException(
            'Automation trigger column is required',
          );
        }

        if (statusId === null) {
          throw new BadRequestException(
            'Automation trigger status is required',
          );
        }

        const status = await this.prisma.statusOption.findFirst({
          where: {
            id: statusId,
            columnId: triggerColumnId,
          },
        });

        if (!status) {
          throw new BadRequestException(
            'Status does not belong to the trigger column',
          );
        }
      }

      // if (!status) {
      //   throw new BadRequestException(
      //     'Status does not belong to the trigger column',
      //   );
      // }
    }

    // Validate target group if it is being updated
    if (dto.action?.groupId !== undefined) {
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
    }

    const data: any = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.trigger?.columnId !== undefined) {
      data.triggerColumnId = dto.trigger.columnId;
    }

    if (dto.trigger?.statusId !== undefined) {
      data.triggerStatusId = dto.trigger.statusId;
    }

    if (dto.action?.groupId !== undefined) {
      data.targetGroupId = dto.action.groupId;
    }

    return this.prisma.automationRule.update({
      where: {
        id: automationId,
      },
      data,
      include: {
        triggerColumn: true,
        triggerStatus: true,
        targetGroup: true,
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
