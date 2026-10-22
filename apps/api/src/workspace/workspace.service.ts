import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceMemberRole } from 'generated/prisma/enums';

function generateUid(): string {
  return randomBytes(9).toString('base64url').substring(0, 12);
}

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
        uid: generateUid(),
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

  async resolveId(idOrUid: string): Promise<number> {
    const num = parseInt(idOrUid, 10);
    if (Number.isInteger(num) && num > 0 && String(num) === idOrUid) return num;
    const ws = await this.prisma.workspace.findUnique({
      where: { uid: idOrUid },
      select: { id: true },
    });
    if (!ws) throw new NotFoundException('Workspace not found.');
    return ws.id;
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
    force = false,
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

    if (force) {
      // Hard delete: strip all assignments, time entries, and remove the record.
      const boardIds = (
        await this.prisma.board.findMany({
          where: { workspaceId },
          select: { id: true },
        })
      ).map((b) => b.id);

      // Remove user from all PERSON-type task cells in workspace boards.
      if (boardIds.length) {
        const personCells = await this.prisma.taskCell.findMany({
          where: { column: { boardId: { in: boardIds }, type: 'PERSON' } },
          select: { id: true, value: true },
        });

        for (const cell of personCells) {
          const v = cell.value as any;
          const users: any[] = Array.isArray(v?.users)
            ? v.users
            : Array.isArray(v)
            ? v
            : [];
          const filtered = users.filter((u: any) => u.userId !== userId);
          if (filtered.length !== users.length) {
            const newValue = Array.isArray(v) ? filtered : { ...v, users: filtered };
            await this.prisma.taskCell.update({
              where: { id: cell.id },
              data: { value: newValue },
            });
          }
        }
      }

      await this.prisma.$transaction([
        // Delete time entries for this user in this workspace.
        this.prisma.timeEntry.deleteMany({
          where: { userId, boardId: { in: boardIds } },
        }),
        // Remove from all board memberships.
        this.prisma.boardMember.deleteMany({
          where: { userId, board: { workspaceId } },
        }),
        // Remove from DM channels.
        this.prisma.chatMember.deleteMany({
          where: { userId, channel: { workspaceId, type: 'DIRECT' } },
        }),
        // Hard delete the workspace member record.
        this.prisma.workspaceMember.delete({ where: { id: memberId } }),
      ]);
    } else {
      // Soft delete: mark deleted, revoke board/chat access but keep assignments.
      await this.prisma.$transaction([
        this.prisma.workspaceMember.update({
          where: { id: memberId },
          data: { deletedAt: new Date() },
        }),
        this.prisma.boardMember.deleteMany({
          where: { userId, board: { workspaceId } },
        }),
        this.prisma.chatMember.deleteMany({
          where: { userId, channel: { workspaceId, type: 'DIRECT' } },
        }),
      ]);
    }
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
            board: { select: { id: true, uid: true, name: true } },
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
        boardUid: task.group.board.uid,
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

  async getCapacity(workspaceId: number) {
    const [members, boards] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      }),
      this.prisma.board.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
      }),
    ]);

    const boardIds = boards.map((b) => b.id);

    if (!boardIds.length) {
      return members.map((m) => ({
        user: m.user, totalTasks: 0, overdueTasks: 0,
        dueSoonTasks: 0, onTrackTasks: 0, noDueDateTasks: 0, tasks: [],
      }));
    }

    const personCells = await this.prisma.taskCell.findMany({
      where: { column: { boardId: { in: boardIds }, type: 'PERSON' } },
      select: {
        value: true,
        task: {
          select: {
            id: true,
            name: true,
            parentId: true,
            group: { select: { id: true, name: true, board: { select: { id: true, name: true } } } },
            cells: {
              select: {
                value: true,
                column: { select: { type: true, statusOptions: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const taskDataMap = new Map<number, any>();
    const userTaskIds = new Map<number, Set<number>>();

    for (const cell of personCells) {
      const task = cell.task;
      if (task.parentId !== null) continue;
      const v = cell.value as any;
      if (!Array.isArray(v?.users) || !v.users.length) continue;

      if (!taskDataMap.has(task.id)) {
        let dueDate: string | null = null;
        let statusLabel: string | null = null;
        let statusColor: string | null = null;

        for (const c of task.cells) {
          if (c.column.type === 'DATE' && c.value) {
            const cv = c.value as any;
            dueDate = cv?.date ?? cv?.value ?? null;
          }
          if (c.column.type === 'STATUS' && c.value) {
            const cv = c.value as any;
            const opts = (c.column.statusOptions as any[]) ?? [];
            const optId = cv?.id ?? cv?.statusOptionId;
            if (optId) {
              const opt = opts.find((o: any) => o.id === optId);
              if (opt) { statusLabel = opt.label; statusColor = opt.color; }
            } else if (cv?.label) {
              statusLabel = cv.label; statusColor = cv.color ?? null;
            }
          }
        }

        taskDataMap.set(task.id, {
          id: task.id, name: task.name,
          boardId: task.group.board.id, boardName: task.group.board.name,
          groupId: task.group.id, groupName: task.group.name, dueDate, statusLabel, statusColor,
        });
      }

      for (const u of v.users) {
        if (!u?.id) continue;
        if (!userTaskIds.has(u.id)) userTaskIds.set(u.id, new Set());
        userTaskIds.get(u.id)!.add(task.id);
      }
    }

    return members.map((m) => {
      const taskIds = [...(userTaskIds.get(m.user.id) ?? [])];
      const tasks = taskIds.map((id) => taskDataMap.get(id)).filter(Boolean);

      let overdueTasks = 0, dueSoonTasks = 0, onTrackTasks = 0, noDueDateTasks = 0;
      for (const t of tasks) {
        if (!t.dueDate) { noDueDateTasks++; continue; }
        const d = new Date(t.dueDate);
        if (d < now) overdueTasks++;
        else if (d <= sevenDaysLater) dueSoonTasks++;
        else onTrackTasks++;
      }

      return {
        user: m.user,
        totalTasks: tasks.length,
        overdueTasks, dueSoonTasks, onTrackTasks, noDueDateTasks,
        tasks,
      };
    });
  }

  async getCalendarTasks(workspaceId: number, month: number, year: number) {
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });
    const boardIds = boards.map((b) => b.id);
    if (!boardIds.length) return [];

    const dateCells = await this.prisma.taskCell.findMany({
      where: {
        column: { boardId: { in: boardIds }, type: 'DATE' },
      },
      select: {
        value: true,
        task: {
          select: {
            id: true,
            name: true,
            parentId: true,
            group: {
              select: {
                id: true,
                name: true,
                color: true,
                board: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const results: {
      id: number;
      name: string;
      date: string;
      groupId: number;
      groupName: string;
      groupColor: string | null;
      boardId: number;
      boardName: string;
    }[] = [];

    for (const cell of dateCells) {
      if (cell.task.parentId !== null) continue;
      const v = cell.value as any;
      const rawDate: string | undefined = v?.date ?? v?.value;
      if (!rawDate) continue;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;

      results.push({
        id: cell.task.id,
        name: cell.task.name,
        date: rawDate,
        groupId: cell.task.group.id,
        groupName: cell.task.group.name,
        groupColor: cell.task.group.color ?? null,
        boardId: cell.task.group.board.id,
        boardName: cell.task.group.board.name,
      });
    }

    return results;
  }
}