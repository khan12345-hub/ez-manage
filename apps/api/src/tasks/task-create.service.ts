import { PrismaService } from "prisma/prisma.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/client';
import { AutomationEngineService } from 'src/automations/automation-engine.service';

@Injectable()
export class TaskCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
    private readonly automationEngineService: AutomationEngineService,
  ) {}

    async create(createTaskDto: CreateTaskDto, userId: number, boardId: number) {
      const ORDER_GAP = 1000;

      const task = await this.prisma.$transaction(async (tx) => {
        const group = await tx.group.findUnique({
          where: {
            id: createTaskDto.groupId,
          },
          select: {
            id: true,
            boardId: true,
          },
        });
  
        if (!group) {
          throw new NotFoundException('Group not found.');
        }
  
        if (group.boardId !== boardId) {
          throw new BadRequestException('Group does not belong to this board.');
        }
  
        let parentId: number | null = null;
  
        if (createTaskDto.parentId) {
          const parentTask = await tx.task.findUnique({
            where: {
              id: createTaskDto.parentId,
            },
            select: {
              id: true,
              groupId: true,
              parentId: true,
            },
          });
  
          if (!parentTask) {
            throw new NotFoundException('Parent task not found.');
          }
  
          if (parentTask.groupId !== createTaskDto.groupId) {
            throw new BadRequestException(
              'Parent task must belong to the same group.',
            );
          }
  
          if (parentTask.parentId !== null) {
            throw new BadRequestException(
              'A subtask cannot have another subtask.',
            );
          }
  
          parentId = parentTask.id;
        }
  
        const lastTask = await tx.task.findFirst({
          where: {
            groupId: createTaskDto.groupId,
            parentId,
          },
          orderBy: {
            order: 'desc',
          },
          select: {
            order: true,
          },
        });
  
        const columns = await tx.boardColumn.findMany({
          where: {
            boardId,
            isPrimary: false,
          },
          select: {
            id: true,
          },
          orderBy: {
            order: 'asc',
          },
        });
  
        const task = await tx.task.create({
          data: {
            groupId: createTaskDto.groupId,
            createdById: userId,
            name: createTaskDto.name,
            parentId,
            order: lastTask ? lastTask.order + ORDER_GAP : ORDER_GAP,
  
            cells: {
              create: columns.map((column) => ({
                column: {
                  connect: {
                    id: column.id,
                  },
                },
              })),
            },
          },
          include: {
            cells: true,
          },
        });
  
        const activityLog = await this.activityLogsService.log(
          {
            boardId,
            groupId: task.groupId,
            taskId: task.id,
            userId,
            entityType: ActivityEntityType.TASK,
            entityId: task.id,
            action: ActivityAction.CREATED,
            metadata: {
              taskName: task.name,
              groupId: task.groupId,
            },
          },
          tx,
        );
  
        console.log({
          'Activity is being created': activityLog,
        });

        return task;
      });

      // Fire TASK_CREATED automations after transaction commits
      this.automationEngineService.handleTaskCreated(task.id, boardId).catch((err) => {
        console.error('[Automation] TASK_CREATED trigger error:', err);
      });

      return task;
    }
}