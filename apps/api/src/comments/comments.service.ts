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
  constructor(private readonly prisma: PrismaService) {}

  async create(
    taskId: number,
    userId: number,
    dto: CreateCommentDto,
    files: any[] = [],
  ) {
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

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: dto.content,

        files: {
          create: files.map((file) => ({
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,

            // Temporary/local storage
            // Replace with your actual uploaded file path
            storageKey: file.filename,
          })),
        },
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
    });

    return comment;
  }

  async createReply(
    taskId: number,
    commentId: number,
    userId: number,
    dto: CreateCommentDto,
    files: any[] = [],
  ) {
    // Check task
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

    // Check parent comment
    const parentComment = await this.prisma.taskComment.findFirst({
      where: {
        id: commentId,
        taskId,
      },
      select: {
        id: true,
        parentId: true,
      },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

    // Optional:
    // Prevent replies to replies.
    if (parentComment.parentId !== null) {
      throw new BadRequestException(
        'You can only reply to a top-level comment',
      );
    }

    const reply = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        parentId: commentId,
        content: dto.content,

        files: {
          create: files.map((file) => ({
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            storageKey: file.filename,
          })),
        },
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
    });

    return reply;
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

  async findAllByTask(taskId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

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

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.taskComment.findMany({
        where: {
          taskId,
          parentId: null,
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
              email: true,
              avatarUrl: true,
            },
          },

          files: true,
          replies: {
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
      }),

      this.prisma.taskComment.count({
        where: {
          taskId,
        },
      }),
    ]);

    return {
      data: comments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  async findOne(boardId: number, id: number) {
    const comment = await this.prisma.taskComment.findFirst({
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
      throw new NotFoundException('Comment not found');
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
    const comment = await this.prisma.taskComment.findFirst({
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
      throw new NotFoundException('Comment not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update the comment itself
      const updatedComment = await tx.taskComment.update({
        where: {
          id,
        },
        data: {
          content: updateCommentDto?.content?.trim(),
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

  async remove(boardId: number, id: number) {
    // Verify comment belongs to this board
    const comment = await this.prisma.taskComment.findFirst({
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
      throw new NotFoundException('Comment not found');
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
