import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';
import { PrismaService } from 'prisma/prisma.service';

interface CreateActivityLogParams {
  boardId: number;
  taskId?: number;
  groupId?: number;
  userId: number;
  entityType: ActivityEntityType;
  entityId: number;
  action: ActivityAction;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateActivityLogParams, tx?: Prisma.TransactionClient) {
    const {
      boardId,
      taskId,
      groupId,
      userId,
      entityType,
      entityId,
      action,
      metadata,
    } = params;
    const client = tx ?? this.prisma;
    console.log('[ActivityLog] Creating activity:', {
      boardId,
      taskId,
      groupId,
      userId,
      entityType,
      entityId,
      action,
      metadata,
      usingTransaction: !!tx,
    });
    if (taskId) {
      const taskExists = await client.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      });
      console.log('[ActivityLog] Task lookup:', {
        taskId,
        taskExists,
        usingTransaction: !!tx,
      });
    }
    return client.activityLog.create({
      data: {
        boardId,
        taskId,
        groupId,
        userId,
        entityType,
        entityId,
        action,
        metadata,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findByBoard(boardId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [activities, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where: {
          boardId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          task: {
            select: {
              id: true,
              name: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      this.prisma.activityLog.count({
        where: {
          boardId,
        },
      }),
    ]);

    return {
      data: activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findByTask(taskId: number, cursor?: string, limit = 20) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const activities = await this.prisma.activityLog.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: {
              id: Number(cursor),
            },
            skip: 1,
          }
        : {}),
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const hasNextPage = activities.length > limit;

    const data = hasNextPage ? activities.slice(0, limit) : activities;

    const nextCursor =
      hasNextPage && data.length > 0 ? String(data[data.length - 1].id) : null;

    return {
      data,
      meta: {
        limit,
        nextCursor,
        hasNextPage,
      },
    };
  }

  async findOne(id: number) {
    const activity = await this.prisma.activityLog.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        undoneBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity log not found');
    }

    return activity;
  }

  async undo(id: number, userId: number) {
    const activity = await this.prisma.activityLog.findUnique({
      where: {
        id,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity log not found');
    }

    if (activity.undoneAt) {
      return activity;
    }

    return this.prisma.activityLog.update({
      where: {
        id,
      },
      data: {
        undoneAt: new Date(),
        undoneById: userId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        undoneBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
