import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType, NotificationEntityType, BoardColumnType } from 'generated/prisma/enums';
import { TaskAnalyzerService } from './task-analyzer.service';

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly taskAnalyzer: TaskAnalyzerService,
  ) {}

  async getManagementTeam(ceoId: number) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);
    if (allowedWorkspaceIds.length === 0) return { members: [], hiddenMembers: [] };

    // Load boards (for task stats)
    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: allowedWorkspaceIds } },
      select: {
        id: true,
        name: true,
        timezone: true,
        boards: { select: { id: true, name: true } },
        members: {
          select: {
            role: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    // Build board info map for task lookups
    type BoardInfo = { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string };
    const boardInfoList: BoardInfo[] = [];
    const boardIds: number[] = [];
    for (const ws of workspaces) {
      for (const b of ws.boards) {
        const info: BoardInfo = { id: b.id, name: b.name, workspaceId: ws.id, workspaceName: ws.name, timezone: ws.timezone || 'UTC' };
        boardInfoList.push(info);
        boardIds.push(b.id);
      }
    }

    // All workspace members visible to the CEO (exclude CEO themselves)
    const autoDetectedMap = new Map<number, { user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }; roles: { workspaceId: number; workspaceName: string; role: string }[] }>();
    for (const ws of workspaces) {
      for (const m of ws.members) {
        if (m.user.id === ceoId) continue;
        if (!autoDetectedMap.has(m.user.id)) {
          autoDetectedMap.set(m.user.id, { user: m.user, roles: [] });
        }
        autoDetectedMap.get(m.user.id)!.roles.push({ workspaceId: ws.id, workspaceName: ws.name, role: m.role });
      }
    }

    // CEO's manual config records
    const configs = await this.prisma.ceoManagementConfig.findMany({
      where: { ceoId },
      select: { memberId: true, isHidden: true, addedManually: true },
    });
    const configMap = new Map(configs.map((c) => [c.memberId, c]));

    // Manually added users not yet in auto-detected
    const manualUserIds = configs
      .filter((c) => c.addedManually && !autoDetectedMap.has(c.memberId))
      .map((c) => c.memberId);

    let manualUsers: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }[] = [];
    if (manualUserIds.length > 0) {
      manualUsers = await this.prisma.user.findMany({
        where: { id: { in: manualUserIds } },
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      });
    }

    // Combine all candidates
    const allCandidates: { user: { id: number; firstName: string; lastName: string; email: string; avatarUrl: string | null }; workspaces: { workspaceId: number; workspaceName: string; role: string }[]; addedManually: boolean }[] = [];

    for (const [userId, entry] of autoDetectedMap) {
      const cfg = configMap.get(userId);
      allCandidates.push({ user: entry.user, workspaces: entry.roles, addedManually: cfg?.addedManually ?? false });
    }
    for (const u of manualUsers) {
      allCandidates.push({ user: u, workspaces: [], addedManually: true });
    }

    // Get task stats for all candidates in batch
    const allUserIds = allCandidates.map((c) => c.user.id);
    const statsMap = await this.batchTaskStats(allUserIds, boardIds, boardInfoList);

    // Separate visible from hidden
    const members: any[] = [];
    const hiddenMembers: any[] = [];

    for (const candidate of allCandidates) {
      const cfg = configMap.get(candidate.user.id);
      const stats = statsMap.get(candidate.user.id) ?? { totalTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, inactiveTasks: 0 };
      const entry = {
        userId: candidate.user.id,
        firstName: candidate.user.firstName,
        lastName: candidate.user.lastName,
        email: candidate.user.email,
        avatarUrl: candidate.user.avatarUrl,
        workspaces: candidate.workspaces,
        addedManually: candidate.addedManually,
        stats,
      };

      if (cfg?.isHidden) {
        hiddenMembers.push(entry);
      } else {
        members.push(entry);
      }
    }

    return { members, hiddenMembers };
  }

  async getManagerDetail(ceoId: number, managerId: number, inactivityDays = 3, upcomingDays = 7) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);
    if (allowedWorkspaceIds.length === 0) throw new ForbiddenException('No admin workspaces.');

    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
    if (!manager) throw new NotFoundException('User not found');

    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: allowedWorkspaceIds } },
      select: {
        id: true, name: true, timezone: true,
        boards: { select: { id: true, name: true } },
        members: {
          select: {
            role: true,
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    type BoardInfo = { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string };
    const boardInfoList: BoardInfo[] = [];
    const boardIds: number[] = [];
    for (const ws of workspaces) {
      for (const b of ws.boards) {
        boardInfoList.push({ id: b.id, name: b.name, workspaceId: ws.id, workspaceName: ws.name, timezone: ws.timezone || 'UTC' });
        boardIds.push(b.id);
      }
    }

    const [taskBreakdown] = await Promise.all([
      this.taskAnalyzer.getUserTaskBreakdown({
        targetUserId: managerId,
        boardIds,
        boards: boardInfoList,
        inactivityDays,
        upcomingDays,
      }),
    ]);

    // Manager's own workspaces — queried directly, not restricted to CEO's access
    const managerMemberships = await this.prisma.workspaceMember.findMany({
      where: { userId: managerId },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            _count: { select: { boards: true } },
            members: {
              select: {
                role: true,
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    // Team = all members in manager's workspaces (excluding manager and CEO)
    const teamMemberMap = new Map<number, { userId: number; firstName: string; lastName: string; avatarUrl: string | null; workspaceId: number; workspaceName: string; role: string }>();
    for (const mem of managerMemberships) {
      for (const m of mem.workspace.members) {
        if (m.user.id === managerId || m.user.id === ceoId) continue;
        if (!teamMemberMap.has(m.user.id)) {
          teamMemberMap.set(m.user.id, {
            userId: m.user.id,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            avatarUrl: m.user.avatarUrl ?? null,
            workspaceId: mem.workspace.id,
            workspaceName: mem.workspace.name,
            role: m.role,
          });
        }
      }
    }

    const teamUserIds = [...teamMemberMap.keys()];
    const teamStatsMap = await this.batchTaskStats(teamUserIds, boardIds, boardInfoList);

    const team = [...teamMemberMap.values()].map((m) => {
      const s = teamStatsMap.get(m.userId) ?? { totalTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, inactiveTasks: 0 };
      return { ...m, stats: s };
    });

    // Workspaces this manager is in (from direct membership query)
    const managerWorkspaces = managerMemberships.map((mem) => ({
      workspaceId: mem.workspace.id,
      workspaceName: mem.workspace.name,
      boardCount: mem.workspace._count.boards,
      memberCount: mem.workspace.members.length,
      role: mem.role,
    }));

    return {
      user: manager,
      tasks: taskBreakdown.tasks,
      taskStats: {
        totalTasks: taskBreakdown.totalTasks,
        doneTasks: taskBreakdown.doneTasks,
        overdueTasks: taskBreakdown.overdueTasks,
        dueSoonTasks: taskBreakdown.dueSoonTasks,
        inactiveTasks: taskBreakdown.inactiveTasks,
      },
      team,
      workspaces: managerWorkspaces,
    };
  }

  async getMemberDetail(ceoId: number, memberId: number, inactivityDays = 3, upcomingDays = 7) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);
    if (allowedWorkspaceIds.length === 0) throw new ForbiddenException('No admin workspaces.');

    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
    if (!member) throw new NotFoundException('User not found');

    const boards = await this.prisma.board.findMany({
      where: { workspaceId: { in: allowedWorkspaceIds } },
      select: { id: true, name: true, workspaceId: true, workspace: { select: { name: true, timezone: true } } },
    });
    const boardInfoList = boards.map((b) => ({
      id: b.id,
      name: b.name,
      workspaceId: b.workspaceId,
      workspaceName: b.workspace.name,
      timezone: b.workspace.timezone || 'UTC',
    }));
    const boardIds = boards.map((b) => b.id);

    const breakdown = await this.taskAnalyzer.getUserTaskBreakdown({
      targetUserId: memberId,
      boardIds,
      boards: boardInfoList,
      inactivityDays,
      upcomingDays,
    });

    return {
      user: member,
      tasks: breakdown.tasks,
      stats: {
        totalTasks: breakdown.totalTasks,
        doneTasks: breakdown.doneTasks,
        overdueTasks: breakdown.overdueTasks,
        dueSoonTasks: breakdown.dueSoonTasks,
        inactiveTasks: breakdown.inactiveTasks,
      },
    };
  }

  async getWorkspaceDetail(ceoId: number, workspaceId: number, inactivityDays = 3, upcomingDays = 7) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);
    if (!allowedWorkspaceIds.includes(workspaceId)) throw new ForbiddenException('Access denied.');

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        timezone: true,
        boards: { select: { id: true, name: true } },
        members: {
          select: {
            role: true,
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const boardInfoList = workspace.boards.map((b) => ({
      id: b.id,
      name: b.name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      timezone: workspace.timezone || 'UTC',
    }));
    const boardIds = workspace.boards.map((b) => b.id);
    const memberIds = workspace.members.map((m) => m.user.id);

    const statsMap = await this.batchTaskStats(memberIds, boardIds, boardInfoList);

    // Also get full task list per member
    const memberTasksMap = await this.batchTaskDetails(memberIds, boardIds, boardInfoList, inactivityDays, upcomingDays);

    const assignees = workspace.members.map((m) => {
      const s = statsMap.get(m.user.id) ?? { totalTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, inactiveTasks: 0 };
      const tasks = memberTasksMap.get(m.user.id) ?? [];
      return {
        userId: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        avatarUrl: m.user.avatarUrl ?? null,
        role: m.role,
        ...s,
        tasks,
      };
    }).filter((a) => a.totalTasks > 0 || a.role === 'OWNER' || a.role === 'ADMIN')
      .sort((a, b) => b.totalTasks - a.totalTasks);

    return {
      workspace: { id: workspace.id, name: workspace.name, boardCount: workspace.boards.length, memberCount: workspace.members.length },
      assignees,
    };
  }

  async getTaskDetail(ceoId: number, taskId: number) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        group: {
          select: {
            name: true,
            board: {
              select: {
                id: true,
                name: true,
                workspace: { select: { id: true, name: true, timezone: true } },
                columns: {
                  where: { type: { in: [BoardColumnType.DATE, BoardColumnType.PLAIN_DATE, BoardColumnType.PERSON, BoardColumnType.STATUS] } },
                  select: { id: true, type: true, name: true },
                },
              },
            },
          },
        },
        cells: { select: { value: true, column: { select: { id: true, type: true } } } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (!allowedWorkspaceIds.includes(task.group.board.workspace.id)) {
      throw new ForbiddenException('Access denied');
    }

    const personCell = task.cells.find((c) => c.column.type === BoardColumnType.PERSON);
    const dateCell = task.cells.find((c) =>
      c.column.type === BoardColumnType.DATE || c.column.type === BoardColumnType.PLAIN_DATE,
    );
    const statusCell = task.cells.find((c) => c.column.type === BoardColumnType.STATUS);

    const assigneeIds = this.extractPersonIds(personCell?.value);
    const dueDate = this.extractDate(dateCell?.value);
    const status = this.extractStatus(statusCell?.value);

    let assignees: { id: number; firstName: string; lastName: string; avatarUrl: string | null }[] = [];
    if (assigneeIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      });
      assignees = users.map((u) => ({ ...u, avatarUrl: u.avatarUrl ?? null }));
    }

    const tz = task.group.board.workspace.timezone || 'UTC';
    let daysOverdue: number | null = null;
    if (dueDate) {
      const todayStr = dueDate.toLocaleDateString('en-CA', { timeZone: tz });
      const nowStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      if (todayStr < nowStr) {
        const diffMs = new Date(nowStr).getTime() - new Date(todayStr).getTime();
        daysOverdue = Math.floor(diffMs / 86_400_000) || 1;
      }
    }

    return {
      id: task.id,
      name: task.name,
      boardId: task.group.board.id,
      boardName: task.group.board.name,
      workspaceId: task.group.board.workspace.id,
      workspaceName: task.group.board.workspace.name,
      groupName: task.group.name,
      dueDate: dueDate?.toISOString() ?? null,
      daysOverdue,
      status,
      assignees,
      comments: task.comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
        author: { ...c.user, avatarUrl: c.user.avatarUrl ?? null },
      })),
      lastActivityAt: task.updatedAt.toISOString(),
    };
  }

  async addCommentToTask(ceoId: number, taskId: number, content: string) {
    const taskDetail = await this.getTaskDetail(ceoId, taskId);

    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId: ceoId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Notify all assignees
    const ceoUser = await this.prisma.user.findUnique({
      where: { id: ceoId },
      select: { firstName: true, lastName: true },
    });
    const ceoName = ceoUser ? `${ceoUser.firstName} ${ceoUser.lastName}` : 'CEO';

    for (const assignee of taskDetail.assignees) {
      if (assignee.id === ceoId) continue;
      void this.notificationsService.notify({
        recipientId: assignee.id,
        type: NotificationType.CEO_TASK_REMINDER,
        title: `Comment from ${ceoName}`,
        message: `On task "${taskDetail.name}": ${content.slice(0, 120)}`,
        entityType: NotificationEntityType.TASK,
        metadata: { taskId, taskName: taskDetail.name, ceoName },
        sendEmail: false,
      } as any);
    }

    return { ...comment, author: { ...comment.user, avatarUrl: comment.user.avatarUrl ?? null } };
  }

  async sendTaskNotification(ceoId: number, taskId: number, assigneeId: number, message: string) {
    const taskDetail = await this.getTaskDetail(ceoId, taskId);

    const ceoUser = await this.prisma.user.findUnique({
      where: { id: ceoId },
      select: { firstName: true, lastName: true },
    });
    const ceoName = ceoUser ? `${ceoUser.firstName} ${ceoUser.lastName}` : 'CEO';

    await this.notificationsService.notify({
      recipientId: assigneeId,
      type: NotificationType.CEO_TASK_REMINDER,
      title: `Reminder from ${ceoName}`,
      message: message || `Please update task: "${taskDetail.name}"`,
      entityType: NotificationEntityType.TASK,
      metadata: { taskId, taskName: taskDetail.name, ceoName },
      sendEmail: false,
    } as any);

    return { sent: true };
  }

  async searchUsers(ceoId: number, query: string) {
    const allowedWorkspaceIds = await this.taskAnalyzer.getAdminWorkspaceIds(ceoId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: { in: allowedWorkspaceIds } },
      select: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
    });
    const uniqueMap = new Map(members.map((m) => [m.user.id, m.user]));
    const all = [...uniqueMap.values()].filter((u) => u.id !== ceoId);
    const q = query.toLowerCase();
    return all
      .filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q))
      .slice(0, 20)
      .map((u) => ({ ...u, avatarUrl: u.avatarUrl ?? null }));
  }

  async addToManagementTeam(ceoId: number, memberId: number) {
    await this.prisma.ceoManagementConfig.upsert({
      where: { ceoId_memberId: { ceoId, memberId } },
      update: { addedManually: true, isHidden: false },
      create: { ceoId, memberId, addedManually: true, isHidden: false },
    });
    return { success: true };
  }

  async hideFromManagementTeam(ceoId: number, memberId: number) {
    await this.prisma.ceoManagementConfig.upsert({
      where: { ceoId_memberId: { ceoId, memberId } },
      update: { isHidden: true },
      create: { ceoId, memberId, isHidden: true },
    });
    return { success: true };
  }

  async showInManagementTeam(ceoId: number, memberId: number) {
    await this.prisma.ceoManagementConfig.upsert({
      where: { ceoId_memberId: { ceoId, memberId } },
      update: { isHidden: false },
      create: { ceoId, memberId, isHidden: false },
    });
    return { success: true };
  }

  async markTaskDone(ceoId: number, taskId: number) {
    const taskDetail = await this.getTaskDetail(ceoId, taskId);

    const statusColumn = await this.prisma.boardColumn.findFirst({
      where: { boardId: taskDetail.boardId, type: BoardColumnType.STATUS },
      select: {
        id: true,
        statusOptions: {
          where: { isArchived: false },
          orderBy: { order: 'asc' },
          select: { id: true, label: true, color: true },
        },
      },
    });

    if (!statusColumn) throw new NotFoundException('No status column found on this board.');

    const doneKeywords = ['done', 'complete', 'completed', 'finished', 'closed', 'deployed', 'shipped', 'resolved'];
    const doneOption =
      statusColumn.statusOptions.find((o) =>
        doneKeywords.some((k) => o.label.toLowerCase().includes(k)),
      ) ?? statusColumn.statusOptions[statusColumn.statusOptions.length - 1];

    const statusValue = doneOption
      ? { label: doneOption.label, color: doneOption.color }
      : { label: 'Done', color: '#10b981' };

    await this.prisma.taskCell.upsert({
      where: { taskId_columnId: { taskId, columnId: statusColumn.id } },
      update: { value: statusValue },
      create: { taskId, columnId: statusColumn.id, value: statusValue },
    });

    const ceoUser = await this.prisma.user.findUnique({
      where: { id: ceoId },
      select: { firstName: true, lastName: true },
    });
    const ceoName = ceoUser ? `${ceoUser.firstName} ${ceoUser.lastName}` : 'CEO';

    for (const assignee of taskDetail.assignees) {
      if (assignee.id === ceoId) continue;
      void this.notificationsService.notify({
        recipientId: assignee.id,
        type: NotificationType.CEO_TASK_REMINDER,
        title: `Task marked done by ${ceoName}`,
        message: `"${taskDetail.name}" has been marked as ${statusValue.label}.`,
        entityType: NotificationEntityType.TASK,
        metadata: { taskId, taskName: taskDetail.name, ceoName },
        sendEmail: false,
      } as any);
    }

    return { success: true, status: statusValue };
  }

  async reassignTask(ceoId: number, taskId: number, assigneeId: number) {
    const taskDetail = await this.getTaskDetail(ceoId, taskId);

    const personColumn = await this.prisma.boardColumn.findFirst({
      where: { boardId: taskDetail.boardId, type: BoardColumnType.PERSON },
      select: { id: true },
    });

    if (!personColumn) throw new NotFoundException('No assignee column on this board.');

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    if (!assignee) throw new NotFoundException('Assignee not found.');

    await this.prisma.taskCell.upsert({
      where: { taskId_columnId: { taskId, columnId: personColumn.id } },
      update: { value: { users: [{ id: assigneeId }] } },
      create: { taskId, columnId: personColumn.id, value: { users: [{ id: assigneeId }] } },
    });

    const ceoUser = await this.prisma.user.findUnique({
      where: { id: ceoId },
      select: { firstName: true, lastName: true },
    });
    const ceoName = ceoUser ? `${ceoUser.firstName} ${ceoUser.lastName}` : 'CEO';

    if (assigneeId !== ceoId) {
      void this.notificationsService.notify({
        recipientId: assigneeId,
        type: NotificationType.CEO_TASK_REMINDER,
        title: `Task assigned by ${ceoName}`,
        message: `You have been assigned to "${taskDetail.name}".`,
        entityType: NotificationEntityType.TASK,
        metadata: { taskId, taskName: taskDetail.name, ceoName },
        sendEmail: false,
      } as any);
    }

    return {
      success: true,
      assignee: { id: assignee.id, firstName: assignee.firstName, lastName: assignee.lastName, avatarUrl: assignee.avatarUrl ?? null },
    };
  }

  async getTaskWorkspaceMembers(ceoId: number, taskId: number) {
    const taskDetail = await this.getTaskDetail(ceoId, taskId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: taskDetail.workspaceId },
      select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    return members
      .filter((m) => m.user.id !== ceoId)
      .map((m) => ({ ...m.user, avatarUrl: m.user.avatarUrl ?? null }));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async batchTaskStats(
    userIds: number[],
    boardIds: number[],
    boardInfoList: { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string }[],
  ): Promise<Map<number, { totalTasks: number; doneTasks: number; overdueTasks: number; dueSoonTasks: number; inactiveTasks: number }>> {
    if (userIds.length === 0 || boardIds.length === 0) return new Map();

    const breakdown = await this.taskAnalyzer.getUserTaskBreakdown({
      targetUserId: -1, // will be ignored; we compute manually here
      boardIds,
      boards: boardInfoList,
      inactivityDays: 3,
      upcomingDays: 7,
    });

    // Re-run per user — batch by fetching tasks once and filtering per user
    const result = new Map<number, { totalTasks: number; doneTasks: number; overdueTasks: number; dueSoonTasks: number; inactiveTasks: number }>();
    for (const uid of userIds) {
      const b = await this.taskAnalyzer.getUserTaskBreakdown({
        targetUserId: uid,
        boardIds,
        boards: boardInfoList,
        inactivityDays: 3,
        upcomingDays: 7,
      });
      result.set(uid, { totalTasks: b.totalTasks, doneTasks: b.doneTasks, overdueTasks: b.overdueTasks, dueSoonTasks: b.dueSoonTasks, inactiveTasks: b.inactiveTasks });
    }
    return result;
  }

  private async batchTaskDetails(
    userIds: number[],
    boardIds: number[],
    boardInfoList: { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string }[],
    inactivityDays: number,
    upcomingDays: number,
  ) {
    const result = new Map<number, any[]>();
    for (const uid of userIds) {
      const b = await this.taskAnalyzer.getUserTaskBreakdown({ targetUserId: uid, boardIds, boards: boardInfoList, inactivityDays, upcomingDays });
      result.set(uid, b.tasks);
    }
    return result;
  }

  private extractPersonIds(value: unknown): number[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.users)) return [];
    return (v.users as any[])
      .map((u) => (typeof u?.id === 'number' ? u.id : typeof u?.id === 'string' ? Number(u.id) : null))
      .filter((id): id is number => id !== null && !isNaN(id));
  }

  private extractDate(value: unknown): Date | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    const raw = v.date ?? v.value ?? v.from;
    if (typeof raw === 'string' && raw) {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private extractStatus(value: unknown): { label: string; color: string } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (typeof v.label === 'string') return { label: v.label, color: (v.color as string) ?? '' };
    return null;
  }
}
