import { PrismaService } from 'prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ActivityLogsService } from 'src/activity-logs/activity-logs.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/client';

@Injectable()
export class TaskQueryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findOne(taskId: number) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            boardId: true,
          },
        },

        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },

        cells: {
          include: {
            column: {
              select: {
                id: true,
                name: true,
                type: true,
                order: true,
              },
            },
          },
          orderBy: {
            column: {
              order: 'asc',
            },
          },
        },

        comments: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },

            files: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
  }
}
