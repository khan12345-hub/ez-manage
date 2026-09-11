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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommentMentionedEvent } from 'src/notifications/events/comment-mentioned.event';
import { NotificationsService } from 'src/notifications/notifications.service';
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly storageService: LocalStorageService,

    private readonly eventEmitter: EventEmitter2,

    private readonly notificationService: NotificationsService,
  ) {}

  private extractMentionedUserIds(content: string): number[] {
    if (!content) {
      return [];
    }

    const mentionedUserIds = new Set<number>();

    const mentionElementRegex = /<[^>]*data-type=["']mention["'][^>]*>/gi;

    const mentionElements = content.match(mentionElementRegex) ?? [];

    for (const element of mentionElements) {
      /**
       * Extract data-id regardless of
       * attribute ordering.
       */
      const idMatch = element.match(/data-id=["'](\d+)["']/i);

      if (!idMatch) {
        continue;
      }

      const userId = Number(idMatch[1]);

      if (Number.isInteger(userId) && userId > 0) {
        mentionedUserIds.add(userId);
      }
    }

    return Array.from(mentionedUserIds);
  }

  private getCommentPreview(content: string): string {
    if (!content) {
      return '';
    }

    return (
      content
        /**
         * Remove HTML tags.
         */
        .replace(/<[^>]*>/g, '')

        /**
         * Convert multiple spaces/newlines
         * into a single space.
         */
        .replace(/\s+/g, ' ')

        .trim()

        /**
         * Keep metadata small.
         */
        .slice(0, 200)
    );
  }

  async create(
    taskId: number,
    userId: number,
    dto: CreateCommentDto,
    files: Express.Multer.File[] = [],
  ) {
    /**

* 1. Verify task exists and get the board ID.
     */
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },

      select: {
        id: true,
        name: true,
        createdById: true,

        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Fetch PERSON cells separately to avoid nested relation filter issues
    const personCells = await this.prisma.taskCell.findMany({
      where: {
        taskId,
        column: { type: 'PERSON' },
      },
      select: { value: true },
    });

    /**

* 2. Create the comment first.
  */
    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,

        userId,

        content: dto.content,
      },
    });

    /**

* 3. Extract mentioned user IDs
* from the Tiptap HTML content.
*
* Example:
*
* <span
* data-type="mention"
* data-id="3"
* data-label="Muhammad Ali"
* >
* @Muhammad Ali
* </span>

*/
    const mentionedUserIds = this.extractMentionedUserIds(dto.content);

    console.log('[Comment Notification] Mentioned user IDs:', mentionedUserIds);

    /**

* 4. Get the comment author's information.
  */
    const mentionedBy = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,

        firstName: true,

        lastName: true,
      },
    });

    /**

* 5. Emit mention notifications.
*
* Do not notify the comment author
* if they mention themselves.
  */
    if (mentionedBy && mentionedUserIds.length > 0) {
      const recipients = mentionedUserIds.filter(
        (recipientId) => recipientId !== userId,
      );

      console.log(
        '[Comment Notification] Notification recipients:',
        recipients,
      );

      for (const recipientId of recipients) {
        const event = new CommentMentionedEvent({
          recipientId,

          commentId: comment.id,

          taskId: task.id,

          boardId: task.group.boardId,

          commentPreview: this.getCommentPreview(dto.content),

          mentionedById: mentionedBy.id,

          mentionedByName: `${mentionedBy.firstName} ${mentionedBy.lastName}`,
        });

        console.log(
          '[Comment Notification] Emitting comment.mentioned event:',
          event,
        );

        this.eventEmitter.emit(
          'comment.mentioned',

          event,
        );
      }
    }

    /**
     * 6. Notify task creator + assigned persons about the new comment.
     *
     * Skip:
     *  - the commenter themselves
     *  - users already notified via @mention (avoid duplicate)
     */
    if (mentionedBy) {
      const actorName = `${mentionedBy.firstName} ${mentionedBy.lastName}`;

      // Collect assigned user IDs from PERSON cells
      const assignedUserIds = new Set<number>();
      for (const cell of personCells) {
        const val = cell.value as any;
        if (val && Array.isArray(val.users)) {
          for (const u of val.users) {
            const id = typeof u?.id === 'number' ? u.id : Number(u?.id);
            if (id > 0) assignedUserIds.add(id);
          }
        }
      }

      // Unique recipients: creator + assigned (deduped)
      const candidateIds = new Set<number>([
        ...(task.createdById ? [task.createdById] : []),
        ...assignedUserIds,
      ]);

      // Remove commenter and already-mentioned users
      const alreadyNotified = new Set(mentionedUserIds);
      alreadyNotified.add(userId);

      for (const recipientId of candidateIds) {
        if (alreadyNotified.has(recipientId)) continue;

        await this.notificationService.notify({
          recipientId,
          type: 'COMMENT_CREATED',
          title: 'New comment on a task',
          message: `${actorName} commented on "${task.name}"`,
          entityType: 'TASK',
          entityId: task.id,
          metadata: {
            taskId: task.id,
            boardId: task.group.boardId,
            commentId: comment.id,
            commentedById: userId,
          },
          eventKey: `comment-created:${comment.id}:${recipientId}`,
          sendEmail: false,
        });
      }
    }

    /**

* 7. Upload and save files.
  */
    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          const uploaded = await this.storageService.upload(file, 'comments');

          /**
           * Create File record.
           */
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

          /**
           * Create comment-file relation.
           */
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

    /**

* 7. Return comment with user and files.
  */
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
    const task = await this.prisma.task.findUnique({
      where: {
        id: taskId,
      },
      select: {
        id: true,
        name: true,
        group: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const parentComment = await this.prisma.taskComment.findFirst({
      where: {
        id: commentId,
        taskId,
      },
      select: {
        id: true,
        userId: true,
        parentId: true,
      },
    });

    if (!parentComment) {
      throw new NotFoundException('Comment not found');
    }

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
      },
    });

    if (files.length > 0) {
      await Promise.all(
        files.map(async (file) => {
          const uploaded = await this.storageService.upload(file, 'comments');

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

    const actor = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const actorName = actor
      ? `${actor.firstName} ${actor.lastName}`
      : 'Someone';

    if (parentComment.userId !== userId) {
      await this.notificationService.notify({
        recipientId: parentComment.userId,
        type: 'COMMENT_REPLY',
        title: 'Someone replied to your comment',
        message: `${actorName} replied to your comment on "${task.name}"`,
        entityType: 'TASK',
        entityId: task.id,
        metadata: {
          taskId: task.id,
          boardId: task.group.boardId,
          commentId: reply.id,
          parentCommentId: parentComment.id,
          repliedById: userId,
        },
        eventKey: `comment-reply:${reply.id}:${parentComment.userId}`,
        sendEmail: true,
      });
    }

    const mentionedUserIds = this.extractMentionedUserIds(dto.content);

    const mentionedRecipients = new Set<number>();

    for (const mentionedUserId of mentionedUserIds) {
      if (
        mentionedUserId !== userId &&
        mentionedUserId !== parentComment.userId
      ) {
        mentionedRecipients.add(mentionedUserId);
      }
    }

    for (const recipientId of mentionedRecipients) {
      await this.notificationService.notify({
        recipientId,
        type: 'COMMENT_MENTION',
        title: 'You were mentioned in a reply',
        message: `${actorName} mentioned you in a reply on "${task.name}"`,
        entityType: 'TASK',
        entityId: task.id,
        metadata: {
          taskId: task.id,
          boardId: task.group.boardId,
          commentId: reply.id,
          parentCommentId: parentComment.id,
          mentionedById: userId,
        },
        eventKey: `comment-mention:${reply.id}:${recipientId}`,
        sendEmail: true,
      });
    }

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

  async toggleReaction(commentId: number, userId: number, emoji: string) {
    const existing = await this.prisma.commentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.commentReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentReaction.create({
        data: { commentId, userId, emoji },
      });
    }

    return this.prisma.commentReaction.findMany({
      where: { commentId },
      select: { id: true, emoji: true, userId: true },
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

          reactions: {
            select: { id: true, emoji: true, userId: true },
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

              reactions: {
                select: { id: true, emoji: true, userId: true },
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
        reactions: reply.reactions,
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

  async findAllTaskFiles(taskId: number) {
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

    const [commentFiles, cellFiles] = await this.prisma.$transaction([
      this.prisma.taskCommentFile.findMany({
        where: {
          comment: {
            taskId,
          },
        },

        include: {
          file: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          comment: {
            select: {
              id: true,
              parentId: true,
              createdAt: true,

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
      }),

      this.prisma.taskCellFile.findMany({
        where: {
          cell: {
            taskId,
          },
        },

        include: {
          file: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },

          cell: {
            include: {
              column: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const commentResults = commentFiles.map((commentFile) => ({
      id: commentFile.file.id,

      fileName: commentFile.file.fileName,
      mimeType: commentFile.file.mimeType,
      fileSize: commentFile.file.fileSize,
      url: commentFile.file.url,
      uploadedAt: commentFile.file.uploadedAt,

      source: 'COMMENT' as const,

      commentId: commentFile.comment.id,
      parentCommentId: commentFile.comment.parentId,

      uploadedBy: commentFile.comment.user,
    }));

    const cellResults = cellFiles.map((cellFile) => ({
      id: cellFile.file.id,

      fileName: cellFile.file.fileName,
      mimeType: cellFile.file.mimeType,
      fileSize: cellFile.file.fileSize,
      url: cellFile.file.url,
      uploadedAt: cellFile.file.uploadedAt,

      source: 'TASK_CELL' as const,

      columnId: cellFile.cell.column.id,
      columnName: cellFile.cell.column.name,

      uploadedBy: cellFile.file.uploadedBy,
    }));

    return [...commentResults, ...cellResults].sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );
  }
}
