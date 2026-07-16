import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardAccessService } from 'src/boards/board-access.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsAccessService: BoardAccessService,
  ) {}
  async create(createTaskDto: CreateTaskDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findUnique({
        where: {
          id: createTaskDto.groupId,
        },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const lastTask = await tx.task.findFirst({
        where: {
          groupId: createTaskDto.groupId,
        },
        orderBy: {
          order: 'desc',
        },
      });

      const order = lastTask ? lastTask.order + 1 : 1;

      const task = await tx.task.create({
        data: {
          groupId: createTaskDto.groupId,
          createdById: userId,
          name: createTaskDto.name,
          order,
        },
      });

      return task;
    });
  }
  async findOne(taskId: number, userId: number) {
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
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    // Verifies both workspace and board access
    await this.boardsAccessService.requireViewer(task.group.boardId, userId);

    return task;
  }

  async update(taskId: number, dto: UpdateTaskDto, userId: number) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    await this.boardsAccessService.requireEditor(task.group.boardId, userId);

    return this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: dto,
    });
  }
}
