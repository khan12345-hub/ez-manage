import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'prisma/prisma.service';

import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { LocalStorageService } from 'src/storage/local-storage.service';
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: LocalStorageService,
  ) {}

  async create(
    taskId: number,
    userId: number,
    dto: CreateCommentDto,
    files: Express.Multer.File[] = [],
  ) {
    // 1. Verify task exists
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

    // 2. Create the comment first
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content: dto.content,
      },
    });

    // 3. Upload and save files
    if (files.length > 0) {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const uploaded = await this.storageService.upload(file, 'comments');

          // Create File record
          const createdFile = await this.prisma.file.create({
            data: {
              fileName: uploaded.fileName,
              mimeType: uploaded.mimeType,
              fileSize: uploaded.fileSize,
              storageKey: uploaded.storageKey,
              url: this.storageService.getUrl(uploaded.storageKey),
              uploadedById: userId,
            },
          });

          await this.prisma.taskCommentFile.create({
            data: {
              commentId: comment.id,
              fileId: createdFile.id,
            },
          });

          return createdFile;
        }),
      );
    }

    // 4. Return comment with user and files
    return this.prisma.taskComment.findUnique({
      where: {
        id: comment.id,
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
  }

  async createReply(
    taskId: number,
    commentId: number,
    userId: number,
    dto: CreateCommentDto,
    files: Express.Multer.File[] = [],
  ) {
    // 1. Verify task exists
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

    // 2. Verify parent comment exists and belongs to this task
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

    // 3. Prevent replies to replies
    if (parentComment.parentId !== null) {
      throw new BadRequestException(
        'You can only reply to a top-level comment',
      );
    }

    // 4. Create the reply first
    const reply = await this.prisma.taskComment.create({
      data: {
        taskId,
        userId,
        parentId: commentId,
        content: dto.content,
      },
    });

    // 5. Upload and save files
    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          const uploaded = await this.storageService.upload(file, 'comments');

          // Create File record
          const createdFile = await this.prisma.file.create({
            data: {
              fileName: uploaded.fileName,
              mimeType: uploaded.mimeType,
              fileSize: uploaded.fileSize,
              storageKey: uploaded.storageKey,
              url: this.storageService.getUrl(uploaded.storageKey),
              uploadedById: userId,
            },
          });

          await this.prisma.taskCommentFile.create({
            data: {
              commentId: reply.id,
              fileId: createdFile.id,
            },
          });
        }),
      );
    }

    // 6. Return reply with user and files
    return this.prisma.taskComment.findUnique({
      where: {
        id: reply.id,
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

          files: {
            include: {
              file: true,
            },
          },

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

              files: {
                include: {
                  file: true,
                },
              },
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

    const formattedComments = comments.map((comment) => ({
      ...comment,

      files: comment.files.map((commentFile) => commentFile.file),

      replies: comment.replies.map((reply) => ({
        ...reply,
        files: reply.files.map((commentFile) => commentFile.file),
      })),
    }));

    return {
      data: formattedComments,
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
    taskId: number,
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
      select: { id: true, userId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You are not allowed to edit this comment');
    }
    if (!dto.content?.trim()) {
      throw new BadRequestException('Comment content cannot be empty');
    }
    return this.prisma.taskComment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        files: { include: { file: true } },
      },
    });
  }

  async remove(taskId: number, commentId: number, userId: number) {
    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId },
      select: { id: true, userId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this comment',
      );
    }
    await this.prisma.taskComment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted successfully' };
  }

  async deleteFile(commentId: number, fileId: number, userId: number) {
    const commentFile = await this.prisma.taskCommentFile.findFirst({
      where: {
        commentId,
        fileId,
      },
      include: {
        file: true,
        comment: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!commentFile) {
      throw new NotFoundException(
        'File not found or does not belong to this comment',
      );
    }

    // Only the comment author can delete the attachment
    if (commentFile.comment.userId !== userId) {
      throw new ForbiddenException('You are not allowed to delete this file');
    }

    // Delete physical file
    await this.storageService.delete(commentFile.file.storageKey);

    // Delete TaskCommentFile relation
    await this.prisma.taskCommentFile.delete({
      where: {
        id: commentFile.id,
      },
    });

    return {
      message: 'File deleted successfully',
    };
  }
}
