import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class boardAllFilesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAllBoardFiles(boardId: number) {
    const board = await this.prisma.board.findUnique({
      where: {
        id: boardId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const [commentFiles, cellFiles] = await this.prisma.$transaction([
      // Files attached to comments
      this.prisma.taskCommentFile.findMany({
        where: {
          comment: {
            task: {
              group: {
                boardId,
              },
            },
          },
        },
        select: {
          file: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              url: true,
              uploadedAt: true,
            },
          },
          comment: {
            select: {
              task: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      // Files attached to FILE cells
      this.prisma.taskCellFile.findMany({
        where: {
          cell: {
            task: {
              group: {
                boardId,
              },
            },
          },
        },
        select: {
          file: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              url: true,
              uploadedAt: true,
            },
          },
          cell: {
            select: {
              task: {
                select: {
                  id: true,
                  name: true,
                },
              },
              column: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const results = [
      ...commentFiles.map((item) => ({
        id: item.file.id,
        name: item.file.fileName,
        url: item.file.url,
        type: this.getFileType(item.file.mimeType),
        updatedAt: item.file.uploadedAt,
        boardName: board.name,
        taskName: item.comment.task.name,
      })),

      ...cellFiles.map((item) => ({
        id: item.file.id,
        name: item.file.fileName,
        url: item.file.url,
        type: this.getFileType(item.file.mimeType),
        updatedAt: item.file.uploadedAt,
        boardName: board.name,
        taskName: item.cell.task.name,
      })),
    ];

    return results.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async deleteBoardFile(boardId: number, fileId: number) {
    // Try cell file first
    const cellFile = await this.prisma.taskCellFile.findFirst({
      where: {
        fileId,
        cell: { task: { group: { boardId } } },
      },
    });

    if (cellFile) {
      await this.prisma.file.delete({ where: { id: fileId } });
      return { message: 'File deleted.' };
    }

    // Try comment file
    const commentFile = await this.prisma.taskCommentFile.findFirst({
      where: {
        fileId,
        comment: { task: { group: { boardId } } },
      },
    });

    if (commentFile) {
      await this.prisma.file.delete({ where: { id: fileId } });
      return { message: 'File deleted.' };
    }

    throw new ForbiddenException('File not found on this board.');
  }

  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    }

    if (mimeType.startsWith('video/')) {
      return 'video';
    }

    if (mimeType.startsWith('audio/')) {
      return 'audio';
    }

    if (mimeType === 'application/pdf') {
      return 'pdf';
    }

    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return 'excel';
    }

    if (mimeType.includes('word') || mimeType.includes('document')) {
      return 'document';
    }

    if (mimeType.includes('zip') || mimeType.includes('compressed')) {
      return 'archive';
    }

    return 'file';
  }

}
