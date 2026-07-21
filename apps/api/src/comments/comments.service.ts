import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    boardId: number,
    taskId: number,
    userId: number,
    dto: CreateCommentDto,
  ) {
    // Verify task exists and belongs to the requested board
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        group: {
          boardId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Task not found or does not belong to this board',
      );
    }

    // Validate parent comment
    if (dto.parentId) {
      const parentComment =
        await this.prisma.taskComment.findUnique({
          where: {
            id: dto.parentId,
          },
          select: {
            id: true,
            taskId: true,
            parentId: true,
          },
        });

      if (!parentComment) {
        throw new NotFoundException(
          'Parent comment not found',
        );
      }

      if (parentComment.taskId !== taskId) {
        throw new BadRequestException(
          'Parent comment does not belong to this task',
        );
      }

      // Prevent nested replies
      if (parentComment.parentId !== null) {
        throw new BadRequestException(
          'Replies cannot be nested more than one level',
        );
      }
    }

    const mentionedUserIds = [
      ...new Set(dto.mentionedUserIds ?? []),
    ];

    // Validate mentioned users
    if (mentionedUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          id: {
            in: mentionedUserIds,
          },
        },
        select: {
          id: true,
        },
      });

      const existingUserIds = new Set(
        users.map((user) => user.id),
      );

      const invalidUserIds = mentionedUserIds.filter(
        (id) => !existingUserIds.has(id),
      );

      if (invalidUserIds.length > 0) {
        throw new BadRequestException(
          'One or more mentioned users do not exist',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId,
          content: dto.content.trim(),
          parentId: dto.parentId ?? null,

          mentions: {
            create: mentionedUserIds.map(
              (mentionedUserId) => ({
                userId: mentionedUserId,
              }),
            ),
          },
        },

        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },

          mentions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      return comment;
    });
  }

  async findAll(boardId: number) {
    return this.prisma.taskComment.findMany({
      where: {
        task: {
          group: {
            boardId,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },

        mentions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(
    boardId: number,
    id: number,
  ) {
    const comment =
      await this.prisma.taskComment.findFirst({
        where: {
          id,
          task: {
            group: {
              boardId,
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },

          mentions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'Comment not found',
      );
    }

    return comment;
  }

  async update(
    boardId: number,
    id: number,
    updateCommentDto: UpdateCommentDto,
  ) {
    // First verify that the comment belongs
    // to a task in this board.
    const comment =
      await this.prisma.taskComment.findFirst({
        where: {
          id,
          task: {
            group: {
              boardId,
            },
          },
        },
        select: {
          id: true,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'Comment not found',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update the comment itself
      const updatedComment =
        await tx.taskComment.update({
          where: {
            id,
          },
          data: {
            content:
              updateCommentDto?.content?.trim(),
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },

            mentions: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        });

      return updatedComment;
    });
  }

  async remove(
    boardId: number,
    id: number,
  ) {
    // Verify comment belongs to this board
    const comment =
      await this.prisma.taskComment.findFirst({
        where: {
          id,
          task: {
            group: {
              boardId,
            },
          },
        },
        select: {
          id: true,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'Comment not found',
      );
    }

    await this.prisma.taskComment.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Comment deleted successfully',
    };
  }
}