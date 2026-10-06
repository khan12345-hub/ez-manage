import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMemberRole } from 'generated/prisma/enums';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWorkspaceDto: CreateWorkspaceDto, userId: number) {
    const name = createWorkspaceDto.name.trim();

    if (!name) {
      throw new BadRequestException('Workspace name is required.');
    }

    const existingWorkspace = await this.prisma.workspace.findFirst({
      where: {
        createdById: userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingWorkspace) {
      throw new ConflictException(
        'A workspace with this name already exists.',
      );
    }

    return this.prisma.workspace.create({
      data: {
        name,
        visibility: createWorkspaceDto.visibility,
        createdById: userId,
        members: {
          create: {
            userId,
            role: WorkspaceMemberRole.OWNER,
          },
        },
      },
    });
  }

  async findAll(userId: number) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
      },
      include: {
        workspace: true,
      },
      orderBy: {
        workspace: {
          createdAt: 'desc',
        },
      },
    });

    return memberships.map(({ workspace, role }) => ({
      ...workspace,
      role,
    }));
  }

  async findOne(workspaceId: number) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },

        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                email: true,
                phone: true,
                lastLoginAt: true,
                createdAt: true,
                chatStatusEmoji: true,
                chatStatusText: true,
              },
            },
          },
        },

        boards: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
            groups: {
              select: {
                _count: {
                  select: { tasks: true },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },

        _count: {
          select: {
            boards: true,
            members: true,
          },
        },

        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return workspace;
  }

  async update(
    workspaceId: number,
    updateWorkspaceDto: UpdateWorkspaceDto,
    userId: number,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const data: { name?: string; visibility?: any } = {};

    if (updateWorkspaceDto.name !== undefined) {
      const name = updateWorkspaceDto.name.trim();

      if (!name) {
        throw new BadRequestException('Workspace name is required.');
      }

      const existingWorkspace = await this.prisma.workspace.findFirst({
        where: {
          createdById: workspace.createdById,
          id: {
            not: workspaceId,
          },
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingWorkspace) {
        throw new ConflictException(
          'A workspace with this name already exists.',
        );
      }

      data.name = name;
    }

    if (updateWorkspaceDto.visibility !== undefined) {
      data.visibility = updateWorkspaceDto.visibility;
    }

    return this.prisma.workspace.update({
      where: {
        id: workspaceId,
      },
      data,
      include: {
        members: {
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

  async remove(workspaceId: number) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const boards = await tx.board.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const boardIds = boards.map((b) => b.id);

      // Delete junction tables that lack onDelete Cascade (order matters)
      if (boardIds.length > 0) {
        await tx.invitationBoard.deleteMany({ where: { boardId: { in: boardIds } } });
        await tx.boardMember.deleteMany({ where: { boardId: { in: boardIds } } });
      }
      await tx.invitation.deleteMany({ where: { workspaceId } });
      await tx.board.deleteMany({ where: { workspaceId } });
      await tx.workspaceMember.deleteMany({ where: { workspaceId } });
      return tx.workspace.delete({ where: { id: workspaceId } });
    });
  }

  async updateMemberRole(
    workspaceId: number,
    memberId: number,
    role: WorkspaceMemberRole,
    requesterId: number,
  ) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found.');
    }

    if (target.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot change the role of the workspace owner.');
    }

    if (role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot assign the OWNER role.');
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(
    workspaceId: number,
    memberId: number,
    requesterId: number,
  ) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!target || target.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found.');
    }

    if (target.role === WorkspaceMemberRole.OWNER) {
      throw new ForbiddenException('Cannot remove the workspace owner.');
    }

    const userId = target.userId;

    return this.prisma.$transaction([
      // Remove departing user from all DM channels in this workspace.
      // Keeps the other participant's history intact while revoking access.
      this.prisma.chatMember.deleteMany({
        where: {
          userId,
          channel: {
            workspaceId,
            type: 'DIRECT',
          },
        },
      }),
      this.prisma.workspaceMember.delete({
        where: { id: memberId },
      }),
    ]);
  }

  async getMemberTasks(workspaceId: number, userId: number) {
    // Get all boards in this workspace
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });
    const boardIds = boards.map((b) => b.id);
    if (!boardIds.length) return [];

    // Find all PERSON-type cells across workspace boards that mention this user
    const personCells = await this.prisma.taskCell.findMany({
      where: {
        column: {
          boardId: { in: boardIds },
          type: 'PERSON',
        },
      },
      select: { taskId: true, value: true },
    });

    // Filter in JS: cell value = { users: [{ id, firstName, lastName, ... }] }
    const assignedTaskIds = [...new Set(
      personCells
        .filter((cell) => {
          const v = cell.value as any;
          return Array.isArray(v?.users) && v.users.some((u: any) => u.id === userId);
        })
        .map((cell) => cell.taskId),
    )];

    if (!assignedTaskIds.length) return [];

    // Fetch full task data with all cells (for date + status + person)
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: assignedTaskIds }, parentId: null },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        group: {
          select: {
            id: true,
            name: true,
            board: { select: { id: true, name: true } },
          },
        },
        cells: {
          select: {
            id: true,
            value: true,
            column: { select: { type: true, name: true, statusOptions: true } },
          },
        },
      },
    });

    // Extract dueDate, status, and person data from cells
    return tasks.map((task) => {
      let dueDate: string | null = null;
      let statusLabel: string | null = null;
      let statusColor: string | null = null;
      let statusCellId: number | null = null;
      let dateCellId: number | null = null;
      let personCellId: number | null = null;
      let statusOptions: any[] = [];
      let assignedUsers: any[] = [];

      for (const cell of task.cells) {
        if (cell.column.type === 'DATE' && cell.value) {
          const v = cell.value as any;
          dueDate = v?.value ?? v?.date ?? (typeof v === 'string' ? v : null);
          dateCellId = cell.id;
        }
        if (cell.column.type === 'STATUS' && cell.value) {
          const v = cell.value as any;
          statusCellId = cell.id;
          statusOptions = (cell.column.statusOptions as any[]) ?? [];
          const optionId = v?.id ?? v?.statusOptionId;
          if (optionId) {
            const opt = statusOptions.find((o: any) => o.id === optionId);
            if (opt) { statusLabel = opt.label; statusColor = opt.color; }
          } else if (v?.label) {
            statusLabel = v.label;
            statusColor = v.color ?? null;
          }
        }
        if (cell.column.type === 'PERSON' && cell.value) {
          const v = cell.value as any;
          personCellId = cell.id;
          if (Array.isArray(v?.users)) assignedUsers = v.users;
        }
      }

      return {
        id: task.id,
        name: task.name,
        dueDate,
        statusLabel,
        statusColor,
        statusCellId,
        dateCellId,
        personCellId,
        statusOptions,
        assignedUsers,
        createdAt: task.createdAt,
        createdBy: task.createdBy,
        boardId: task.group.board.id,
        boardName: task.group.board.name,
        groupName: task.group.name,
      };
    });
  }

  async getMemberActivity(workspaceId: number, userId: number) {
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const boardIds = boards.map((b) => b.id);
    if (!boardIds.length) return [];

    const [logs, comments] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { boardId: { in: boardIds }, userId, undoneAt: null },
        select: {
          id: true,
          action: true,
          entityType: true,
          metadata: true,
          createdAt: true,
          task: {
            select: {
              id: true,
              name: true,
              group: { select: { name: true, board: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.taskComment.findMany({
        where: {
          userId,
          parentId: null,
          task: { group: { boardId: { in: boardIds } } },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          task: {
            select: {
              id: true,
              name: true,
              group: { select: { name: true, board: { select: { id: true, name: true } } } },
            },
          },
          mentions: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          reactions: { select: { emoji: true, userId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);

    const items = [
      ...comments.map((c) => ({ kind: 'comment' as const, ...c })),
      ...logs.map((l) => ({ kind: 'log' as const, ...l })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 60);

    return items;
  }
}