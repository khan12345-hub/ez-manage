import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationEntityType, NotificationType } from 'generated/prisma/enums';
import { CreateFileCommentDto } from './dto/create-file-comment.dto';
import { BoardAccessService } from 'src/boards/board-access.service';
import { BoardPermission } from '@repo/shared';

@Injectable()
export class FileCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly boardAccess: BoardAccessService,
  ) {}

  // Resolves the board that owns this file via the cell → task → group chain.
  // Throws NotFoundException (not ForbiddenException) for both "file not found"
  // and "file has no board association" so callers cannot probe file existence.
  private async resolveFileBoardId(fileId: number): Promise<number> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        cells: {
          take: 1,
          select: {
            cell: {
              select: {
                task: {
                  select: { group: { select: { boardId: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!file) throw new NotFoundException('File not found.');
    const boardId = file.cells?.[0]?.cell?.task?.group?.boardId ?? null;
    // Fail closed: if no cell association the board cannot be established.
    if (boardId === null) throw new NotFoundException('File not found.');
    return boardId;
  }

  async findAll(fileId: number, userId: number) {
    const boardId = await this.resolveFileBoardId(fileId);
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.VIEW);

    return this.prisma.fileComment.findMany({
      where: { fileId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async create(fileId: number, userId: number, dto: CreateFileCommentDto) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        fileName: true,
        uploadedById: true,
        cells: {
          take: 1,
          select: {
            cell: {
              select: {
                task: {
                  select: {
                    group: { select: { boardId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!file) throw new NotFoundException('File not found.');

    const boardId = file.cells?.[0]?.cell?.task?.group?.boardId ?? null;
    // Fail closed: board must be established before any write.
    if (boardId === null) throw new NotFoundException('File not found.');

    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EDIT);

    const comment = await this.prisma.fileComment.create({
      data: {
        fileId,
        userId,
        content: dto.content,
        ...(dto.assignedToId ? { assignedToId: dto.assignedToId } : {}),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    // Fire-and-forget notification — never block the response
    if (file.uploadedById !== userId) {
      this.sendNotification(file, comment.id, userId, dto.content, boardId).catch(() => {});
    }

    return comment;
  }

  private async sendNotification(
    file: { id: number; fileName: string; uploadedById: number },
    commentId: number,
    commenterId: number,
    content: string,
    boardId: number | null,
  ) {
    const commenter = await this.prisma.user.findUnique({
      where: { id: commenterId },
      select: { firstName: true, lastName: true },
    });
    const name = commenter
      ? `${commenter.firstName} ${commenter.lastName}`.trim()
      : 'Someone';

    const plain = content.replace(/<[^>]*>/g, '').trim();

    await this.notifications.notify({
      recipientId: file.uploadedById,
      type: NotificationType.FILE_COMMENT,
      title: '💬 Comment on your file',
      message: `${name} commented on "${file.fileName}": ${plain.slice(0, 80)}`,
      entityType: NotificationEntityType.FILE,
      entityId: file.id,
      metadata: { fileId: file.id, fileName: file.fileName, commentId, ...(boardId ? { boardId } : {}) },
      eventKey: `file-comment-${commentId}`,
    });
  }

  async remove(fileId: number, commentId: number, userId: number) {
    const boardId = await this.resolveFileBoardId(fileId);
    await this.boardAccess.requirePermission(boardId, userId, BoardPermission.EDIT);

    const comment = await this.prisma.fileComment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.fileId !== fileId) {
      throw new NotFoundException('Comment not found.');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments.');
    }

    await this.prisma.fileComment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}
