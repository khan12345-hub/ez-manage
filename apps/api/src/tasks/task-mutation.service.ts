import { PrismaService } from "prisma/prisma.service";
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTaskDto } from "./dto/update-task.dto";

@Injectable()
export class TaskMutationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async update(taskId: number, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: dto,
    });
  }

  async remove(taskId: number) {
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        subtasks: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }



    await this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });

    return {
      message: 'Task deleted successfully.',
    };
  }
}