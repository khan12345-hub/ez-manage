import { PrismaService } from "prisma/prisma.service";
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTaskDto } from "./dto/update-task.dto";
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';

@Injectable()
export class TaskMutationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async update(taskId: number, dto: UpdateTaskDto, userId: number, boardId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, groupId: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
    });

    await this.activityLogsService.log({
      boardId,
      taskId,
      groupId: task.groupId,
      userId,
      entityType: ActivityEntityType.TASK,
      entityId: taskId,
      action: ActivityAction.UPDATED,
      metadata: {
        taskName: task.name,
        ...(dto.name !== undefined ? { oldName: task.name, newName: dto.name } : {}),
      },
    });

    return updated;
  }

  async remove(taskId: number, userId: number, boardId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, groupId: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    // Log after delete; no taskId/groupId to avoid cascade-deletion of the log record
    await this.activityLogsService.log({
      boardId,
      userId,
      entityType: ActivityEntityType.TASK,
      entityId: taskId,
      action: ActivityAction.DELETED,
      metadata: { taskName: task.name, groupId: task.groupId },
    });

    return {
      message: 'Task deleted successfully.',
    };
  }
}
