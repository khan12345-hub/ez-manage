import { PrismaService } from "prisma/prisma.service";
import {
  ConflictException,
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
    const { updatedAt: clientUpdatedAt, ...updateData } = dto;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, groupId: true, updatedAt: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    let updated: Awaited<ReturnType<typeof this.prisma.task.findUniqueOrThrow>>;

    if (clientUpdatedAt !== undefined) {
      // Conditional update: only succeeds if updatedAt matches (no concurrent write)
      const clientDate = new Date(clientUpdatedAt);
      const result = await this.prisma.task.updateMany({
        where: { id: taskId, updatedAt: clientDate },
        data: updateData,
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Task was modified by another user. Please refresh and try again.',
        );
      }

      updated = (await this.prisma.task.findUniqueOrThrow({ where: { id: taskId } }));
    } else {
      updated = await this.prisma.task.update({
        where: { id: taskId },
        data: updateData,
      });
    }

    // Activity log uses the pre-update snapshot read above.
    // If clientUpdatedAt was set and the conditional update succeeded, that snapshot
    // is guaranteed to reflect the actual prior committed state.
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
