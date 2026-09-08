import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';


@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      newUsersThisMonth,
      totalWorkspaces,
      totalBoards,
      totalTasks,
      storageAgg,
      imageSize,
      videoSize,
      docSize,
      totalFiles,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.workspace.count(),
      this.prisma.board.count(),
      this.prisma.task.count({ where: { parentId: null } }),
      this.prisma.file.aggregate({ _sum: { fileSize: true } }),
      this.prisma.file.aggregate({
        _sum: { fileSize: true },
        where: { mimeType: { startsWith: 'image/' } },
      }),
      this.prisma.file.aggregate({
        _sum: { fileSize: true },
        where: { mimeType: { startsWith: 'video/' } },
      }),
      this.prisma.file.aggregate({
        _sum: { fileSize: true },
        where: {
          mimeType: { not: { startsWith: 'image/' } },
          AND: [{ mimeType: { not: { startsWith: 'video/' } } }],
        },
      }),
      this.prisma.file.count(),
    ]);

    const totalBytes = storageAgg._sum.fileSize ?? 0;

    return {
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
      },
      workspaces: {
        total: totalWorkspaces,
      },
      boards: {
        total: totalBoards,
      },
      tasks: {
        total: totalTasks,
      },
      storage: {
        totalBytes,
        totalFiles,
        imageBytes: imageSize._sum.fileSize ?? 0,
        videoBytes: videoSize._sum.fileSize ?? 0,
        docBytes: docSize._sum.fileSize ?? 0,
      },
    };
  }

  async getAllWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            boards: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const taskCounts = await Promise.all(
      workspaces.map((w) =>
        this.prisma.task.count({
          where: { group: { board: { workspaceId: w.id } } },
        }),
      ),
    );

    return workspaces.map((w, i) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt,
      members: w._count.members,
      boards: w._count.boards,
      tasks: taskCounts[i],
    }));
  }

  async deleteWorkspace(id: number) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    await this.prisma.workspace.delete({ where: { id } });
    return { message: 'Workspace deleted' };
  }

  async getAllBoards() {
    const boards = await this.prisma.board.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        workspace: { select: { name: true } },
        _count: { select: { groups: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const taskCounts = await Promise.all(
      boards.map((b) =>
        this.prisma.task.count({ where: { group: { boardId: b.id } } }),
      ),
    );

    return boards.map((b, i) => ({
      id: b.id,
      name: b.name,
      workspaceName: b.workspace.name,
      groups: b._count.groups,
      tasks: taskCounts[i],
    }));
  }

  async deleteBoard(id: number) {
    const board = await this.prisma.board.findUnique({ where: { id } });
    if (!board) throw new NotFoundException('Board not found');
    await this.prisma.board.delete({ where: { id } });
    return { message: 'Board deleted' };
  }

  async getAllFiles() {
    const files = await this.prisma.file.findMany({
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        uploadedAt: true,
        cells: {
          take: 1,
          select: {
            cell: {
              select: {
                task: {
                  select: {
                    group: {
                      select: {
                        board: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });

    return files.map((f) => ({
      id: f.id,
      name: f.fileName,
      mimeType: f.mimeType,
      fileSize: f.fileSize,
      uploadedAt: f.uploadedAt,
      boardName: f.cells[0]?.cell?.task?.group?.board?.name ?? null,
    }));
  }

  async deleteFile(id: number) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    await this.prisma.file.delete({ where: { id } });
    return { message: 'File deleted' };
  }
}
