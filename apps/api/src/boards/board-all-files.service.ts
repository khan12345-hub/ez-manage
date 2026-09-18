import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export interface BoardFilesQuery {
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class boardAllFilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllBoardFiles(boardId: number, query: BoardFilesQuery = {}) {
    const { type, search, page = 1, limit = 80 } = query;

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, name: true },
    });

    if (!board) throw new NotFoundException('Board not found');

    const mimeFilter = this.buildMimeFilter(type);
    const searchFilter = search?.trim()
      ? { contains: search.trim(), mode: 'insensitive' as const }
      : undefined;

    const fileWhere = {
      ...(mimeFilter ? { mimeType: mimeFilter } : {}),
      ...(searchFilter ? { fileName: searchFilter } : {}),
      // Exclude files still being downloaded or failed
      NOT: { storageKey: { startsWith: 'http' } },
    };

    const [commentFiles, cellFiles] = await Promise.all([
      this.prisma.taskCommentFile.findMany({
        where: {
          file: fileWhere,
          comment: { task: { group: { boardId } } },
        },
        select: {
          file: { select: { id: true, fileName: true, mimeType: true, url: true, uploadedAt: true } },
          comment: { select: { task: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.taskCellFile.findMany({
        where: {
          file: fileWhere,
          cell: { task: { group: { boardId } } },
        },
        select: {
          file: { select: { id: true, fileName: true, mimeType: true, url: true, uploadedAt: true } },
          cell: { select: { task: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    const all = [
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
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Deduplicate by file id (a file can appear in both cell and comment)
    const seen = new Set<number>();
    const deduped = all.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    const total = deduped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const files = deduped.slice((safePage - 1) * limit, safePage * limit);

    return { files, total, page: safePage, totalPages };
  }

  private buildMimeFilter(type?: string) {
    if (!type || type === 'all') return null;
    const map: Record<string, any> = {
      image:    { startsWith: 'image/' },
      pdf:      { equals: 'application/pdf' },
      video:    { startsWith: 'video/' },
      audio:    { startsWith: 'audio/' },
      document: { contains: 'word' },
      excel:    { contains: 'excel' },
    };
    return map[type] ?? null;
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
