import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BoardColumnType } from 'generated/prisma/enums';

const DONE_KEYWORDS = ['done', 'complete', 'completed', 'finished', 'closed', 'deployed', 'shipped', 'resolved'];

export interface TaskSummary {
  taskId: number;
  taskName: string;
  boardId: number;
  boardName: string;
  workspaceId: number;
  workspaceName: string;
  groupName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  status: string | null;
  statusColor: string | null;
  lastActivityAt: string;
  categories: ('overdue' | 'due_soon' | 'inactive')[];
}

export interface EmployeeTaskGroup {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  overdue: TaskSummary[];
  dueSoon: TaskSummary[];
  inactive: TaskSummary[];
  totalCount: number;
}

export interface MyTaskItem {
  taskId: number;
  taskName: string;
  boardId: number;
  boardName: string;
  workspaceId: number;
  workspaceName: string;
  groupName: string;
  dueDate: string | null;
  daysOverdue: number | null;
  status: string | null;
  statusColor: string | null;
  category: 'overdue' | 'due_soon' | 'on_track' | 'done' | 'inactive';
}

export interface TeamProgressItem {
  workspaceId: number;
  workspaceName: string;
  ownerId: number;
  ownerName: string;
  ownerAvatarUrl: string | null;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  memberCount: number;
}

export interface TaskOverview {
  stats: {
    overdueCount: number;
    dueSoonCount: number;
    inactiveCount: number;
    employeeCount: number;
  };
  employees: EmployeeTaskGroup[];
  summary: {
    workspaceCount: number;
    boardCount: number;
    teamMemberCount: number;
  };
  myTasks: MyTaskItem[];
  teamProgress: TeamProgressItem[];
}

/** Returns "YYYY-MM-DD" string for the given date in the given IANA timezone. */
function localDateStr(date: Date, timezone: string): string {
  try {
    return date.toLocaleDateString('en-CA', { timeZone: timezone }); // "2024-10-15"
  } catch {
    return date.toLocaleDateString('en-CA', { timeZone: 'UTC' });
  }
}

/** Returns how many whole days earlier `a` is compared to `b` (negative = a is before b). */
function dayDiff(a: Date, b: Date): number {
  const aMs = Date.UTC(
    Number(a.toISOString().slice(0, 4)),
    Number(a.toISOString().slice(5, 7)) - 1,
    Number(a.toISOString().slice(8, 10)),
  );
  const bMs = Date.UTC(
    Number(b.toISOString().slice(0, 4)),
    Number(b.toISOString().slice(5, 7)) - 1,
    Number(b.toISOString().slice(8, 10)),
  );
  return Math.floor((aMs - bMs) / 86_400_000);
}

@Injectable()
export class TaskAnalyzerService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(params: {
    userId: number;
    workspaceIds?: number[];
    inactivityDays: number;
    upcomingDays: number;
  }): Promise<TaskOverview> {
    const { userId, workspaceIds, inactivityDays, upcomingDays } = params;

    const allowedWorkspaceIds = await this.getAdminWorkspaceIds(userId, workspaceIds);

    if (allowedWorkspaceIds.length === 0) {
      return { stats: { overdueCount: 0, dueSoonCount: 0, inactiveCount: 0, employeeCount: 0 }, employees: [], summary: { workspaceCount: 0, boardCount: 0, teamMemberCount: 0 }, myTasks: [], teamProgress: [] };
    }

    const boards = await this.prisma.board.findMany({
      where: { workspaceId: { in: allowedWorkspaceIds } },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        workspace: { select: { id: true, name: true, timezone: true } },
        columns: {
          where: { type: { in: [BoardColumnType.DATE, BoardColumnType.PLAIN_DATE, BoardColumnType.PERSON, BoardColumnType.STATUS] } },
          select: { id: true, type: true, name: true },
        },
      },
    });

    if (boards.length === 0) {
      return { stats: { overdueCount: 0, dueSoonCount: 0, inactiveCount: 0, employeeCount: 0 }, employees: [], summary: { workspaceCount: 0, boardCount: 0, teamMemberCount: 0 }, myTasks: [], teamProgress: [] };
    }

    const boardIds = boards.map((b) => b.id);

    // Use UTC for inactivityCutoff — this is a time-based comparison (absolute), not date-based
    const inactivityCutoff = new Date();
    inactivityCutoff.setDate(inactivityCutoff.getDate() - inactivityDays);

    const tasks = await this.prisma.task.findMany({
      where: {
        group: { boardId: { in: boardIds }, isArchived: false },
        parentId: null,
      },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        group: { select: { name: true, boardId: true } },
        cells: {
          select: {
            value: true,
            column: { select: { id: true, type: true } },
          },
        },
        comments: {
          where: { createdAt: { gte: inactivityCutoff } },
          select: { id: true },
          take: 1,
        },
        timeEntries: {
          where: { createdAt: { gte: inactivityCutoff } },
          select: { id: true },
          take: 1,
        },
      },
    });

    const boardMap = new Map(boards.map((b) => [b.id, b]));

    // Cache "today" string per timezone to avoid recomputing per task
    const now = new Date();
    const tzTodayCache = new Map<string, string>();
    const getTodayStr = (tz: string) => {
      if (!tzTodayCache.has(tz)) tzTodayCache.set(tz, localDateStr(now, tz));
      return tzTodayCache.get(tz)!;
    };

    const employeeMap = new Map<number, EmployeeTaskGroup>();

    for (const task of tasks) {
      const board = boardMap.get(task.group.boardId);
      if (!board) continue;

      const timezone = board.workspace.timezone || 'UTC';
      const todayStr = getTodayStr(timezone);

      const dateCell = task.cells.find((c) =>
        c.column.type === BoardColumnType.DATE || c.column.type === BoardColumnType.PLAIN_DATE,
      );
      const personCell = task.cells.find((c) => c.column.type === BoardColumnType.PERSON);
      const statusCell = task.cells.find((c) => c.column.type === BoardColumnType.STATUS);

      const dueDate = this.extractDate(dateCell?.value);
      const assignedUserIds = this.extractPersonIds(personCell?.value);
      const status = this.extractStatus(statusCell?.value);

      if (assignedUserIds.length === 0) continue;

      const isDone = this.isStatusDone(status?.label);
      if (isDone) continue;

      let daysOverdue: number | null = null;
      const categories: TaskSummary['categories'] = [];

      if (dueDate) {
        const dueDateStr = localDateStr(dueDate, timezone);

        if (dueDateStr < todayStr) {
          // Parse both as UTC-date-only to count days
          const diff = dayDiff(new Date(todayStr), new Date(dueDateStr));
          daysOverdue = diff > 0 ? diff : 1;
          categories.push('overdue');
        } else {
          // How many days until due?
          const diffDays = dayDiff(new Date(dueDateStr), new Date(todayStr));
          if (diffDays >= 0 && diffDays <= upcomingDays) {
            categories.push('due_soon');
          }
        }
      }

      const hasRecentComment = task.comments.length > 0;
      const hasRecentTimeEntry = task.timeEntries.length > 0;
      const isInactive = task.updatedAt < inactivityCutoff && !hasRecentComment && !hasRecentTimeEntry;
      if (isInactive && !categories.includes('overdue')) {
        categories.push('inactive');
      }

      if (categories.length === 0) continue;

      const summary: TaskSummary = {
        taskId: task.id,
        taskName: task.name,
        boardId: board.id,
        boardName: board.name,
        workspaceId: board.workspace.id,
        workspaceName: board.workspace.name,
        groupName: task.group.name,
        dueDate: dueDate?.toISOString() ?? null,
        daysOverdue,
        status: status?.label ?? null,
        statusColor: status?.color ?? null,
        lastActivityAt: task.updatedAt.toISOString(),
        categories,
      };

      for (const uid of assignedUserIds) {
        if (!employeeMap.has(uid)) {
          employeeMap.set(uid, {
            user: { id: uid, firstName: '', lastName: '', email: '', avatarUrl: null },
            overdue: [],
            dueSoon: [],
            inactive: [],
            totalCount: 0,
          });
        }
        const group = employeeMap.get(uid)!;
        if (categories.includes('overdue')) group.overdue.push(summary);
        if (categories.includes('due_soon')) group.dueSoon.push(summary);
        if (categories.includes('inactive') && !categories.includes('overdue')) group.inactive.push(summary);
        group.totalCount++;
      }
    }

    if (employeeMap.size === 0) {
      return { stats: { overdueCount: 0, dueSoonCount: 0, inactiveCount: 0, employeeCount: 0 }, employees: [], summary: { workspaceCount: 0, boardCount: 0, teamMemberCount: 0 }, myTasks: [], teamProgress: [] };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...employeeMap.keys()] } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });

    for (const user of users) {
      const group = employeeMap.get(user.id);
      if (group) {
        group.user = { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, avatarUrl: user.avatarUrl ?? null };
      }
    }

    const employees = [...employeeMap.values()].filter((e) => e.user.email).sort((a, b) => b.totalCount - a.totalCount);

    const overdueCount = employees.reduce((s, e) => s + e.overdue.length, 0);
    const dueSoonCount = employees.reduce((s, e) => s + e.dueSoon.length, 0);
    const inactiveCount = employees.reduce((s, e) => s + e.inactive.length, 0);

    // ── Extended summary, myTasks, teamProgress ──────────────────────────────
    const [extended] = await Promise.all([
      this.getSummaryData({ userId, allowedWorkspaceIds, inactivityDays, upcomingDays }),
    ]);

    return {
      stats: { overdueCount, dueSoonCount, inactiveCount, employeeCount: employees.length },
      employees,
      summary: extended.summary,
      myTasks: extended.myTasks,
      teamProgress: extended.teamProgress,
    };
  }

  async getSummaryData(params: {
    userId: number;
    allowedWorkspaceIds: number[];
    inactivityDays: number;
    upcomingDays: number;
  }): Promise<{ summary: TaskOverview['summary']; myTasks: MyTaskItem[]; teamProgress: TeamProgressItem[] }> {
    const { userId, allowedWorkspaceIds, inactivityDays, upcomingDays } = params;

    if (allowedWorkspaceIds.length === 0) {
      return {
        summary: { workspaceCount: 0, boardCount: 0, teamMemberCount: 0 },
        myTasks: [],
        teamProgress: [],
      };
    }

    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: allowedWorkspaceIds } },
      select: {
        id: true,
        name: true,
        timezone: true,
        boards: { select: { id: true, name: true } },
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    const boardCount = workspaces.reduce((s, w) => s + w.boards.length, 0);
    const uniqueMembers = new Set(workspaces.flatMap((w) => w.members.map((m) => m.userId)));
    const teamMemberCount = uniqueMembers.size;

    type BoardInfo = { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string };
    const boardInfoMap = new Map<number, BoardInfo>();
    const boardToWorkspace = new Map<number, number>();
    for (const ws of workspaces) {
      for (const b of ws.boards) {
        boardInfoMap.set(b.id, { id: b.id, name: b.name, workspaceId: ws.id, workspaceName: ws.name, timezone: ws.timezone || 'UTC' });
        boardToWorkspace.set(b.id, ws.id);
      }
    }

    const allBoardIds = [...boardInfoMap.keys()];
    if (allBoardIds.length === 0) {
      return {
        summary: { workspaceCount: allowedWorkspaceIds.length, boardCount: 0, teamMemberCount },
        myTasks: [],
        teamProgress: [],
      };
    }

    const now = new Date();
    const tzTodayCache = new Map<string, string>();
    const getTodayStr = (tz: string) => {
      if (!tzTodayCache.has(tz)) tzTodayCache.set(tz, localDateStr(now, tz));
      return tzTodayCache.get(tz)!;
    };
    const inactivityCutoff = new Date();
    inactivityCutoff.setDate(inactivityCutoff.getDate() - inactivityDays);

    const tasks = await this.prisma.task.findMany({
      where: { group: { boardId: { in: allBoardIds }, isArchived: false }, parentId: null },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        group: { select: { name: true, boardId: true } },
        cells: { select: { value: true, column: { select: { id: true, type: true } } } },
        comments: { where: { createdAt: { gte: inactivityCutoff } }, select: { id: true }, take: 1 },
        timeEntries: { where: { createdAt: { gte: inactivityCutoff } }, select: { id: true }, take: 1 },
      },
    });

    // Workspace progress map — keyed by workspaceId
    const wsProgressMap = new Map<number, TeamProgressItem>();
    for (const ws of workspaces) {
      const owner = ws.members.find((m) => m.role === 'OWNER') ?? ws.members[0];
      if (!owner) continue;
      wsProgressMap.set(ws.id, {
        workspaceId: ws.id,
        workspaceName: ws.name,
        ownerId: owner.userId,
        ownerName: `${owner.user.firstName} ${owner.user.lastName}`,
        ownerAvatarUrl: owner.user.avatarUrl ?? null,
        totalTasks: 0,
        doneTasks: 0,
        overdueTasks: 0,
        dueSoonTasks: 0,
        memberCount: ws.members.length,
      });
    }

    const myTasksList: MyTaskItem[] = [];

    for (const task of tasks) {
      const board = boardInfoMap.get(task.group.boardId);
      if (!board) continue;

      const personCell = task.cells.find((c) => c.column.type === BoardColumnType.PERSON);
      const dateCell = task.cells.find((c) =>
        c.column.type === BoardColumnType.DATE || c.column.type === BoardColumnType.PLAIN_DATE,
      );
      const statusCell = task.cells.find((c) => c.column.type === BoardColumnType.STATUS);

      const assignedUserIds = this.extractPersonIds(personCell?.value);
      const dueDate = this.extractDate(dateCell?.value);
      const status = this.extractStatus(statusCell?.value);
      const isDone = this.isStatusDone(status?.label);

      const timezone = board.timezone;
      const todayStr = getTodayStr(timezone);

      let category: MyTaskItem['category'] = 'on_track';
      let daysOverdue: number | null = null;

      if (isDone) {
        category = 'done';
      } else if (dueDate) {
        const dueDateStr = localDateStr(dueDate, timezone);
        if (dueDateStr < todayStr) {
          const diff = dayDiff(new Date(todayStr), new Date(dueDateStr));
          daysOverdue = diff > 0 ? diff : 1;
          category = 'overdue';
        } else {
          const diffDays = dayDiff(new Date(dueDateStr), new Date(todayStr));
          if (diffDays >= 0 && diffDays <= upcomingDays) category = 'due_soon';
        }
      } else {
        const hasRecentComment = task.comments.length > 0;
        const hasRecentTimeEntry = task.timeEntries.length > 0;
        if (task.updatedAt < inactivityCutoff && !hasRecentComment && !hasRecentTimeEntry) {
          category = 'inactive';
        }
      }

      // teamProgress
      const wsId = boardToWorkspace.get(task.group.boardId);
      if (wsId && assignedUserIds.length > 0) {
        const wsStats = wsProgressMap.get(wsId);
        if (wsStats) {
          wsStats.totalTasks++;
          if (category === 'done') wsStats.doneTasks++;
          if (category === 'overdue') wsStats.overdueTasks++;
          if (category === 'due_soon') wsStats.dueSoonTasks++;
        }
      }

      // myTasks — tasks assigned to CEO
      if (assignedUserIds.includes(userId)) {
        myTasksList.push({
          taskId: task.id,
          taskName: task.name,
          boardId: board.id,
          boardName: board.name,
          workspaceId: board.workspaceId,
          workspaceName: board.workspaceName,
          groupName: task.group.name,
          dueDate: dueDate?.toISOString() ?? null,
          daysOverdue,
          status: status?.label ?? null,
          statusColor: status?.color ?? null,
          category,
        });
      }
    }

    const categoryOrder: Record<string, number> = { overdue: 0, due_soon: 1, inactive: 2, on_track: 3, done: 4 };
    myTasksList.sort((a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9));

    return {
      summary: { workspaceCount: allowedWorkspaceIds.length, boardCount, teamMemberCount },
      myTasks: myTasksList,
      teamProgress: [...wsProgressMap.values()],
    };
  }

  async getUserTaskBreakdown(params: {
    targetUserId: number;
    boardIds: number[];
    boards: { id: number; name: string; workspaceId: number; workspaceName: string; timezone: string }[];
    inactivityDays: number;
    upcomingDays: number;
  }): Promise<{
    totalTasks: number;
    doneTasks: number;
    overdueTasks: number;
    dueSoonTasks: number;
    inactiveTasks: number;
    tasks: MyTaskItem[];
  }> {
    const { targetUserId, boardIds, boards, inactivityDays, upcomingDays } = params;

    if (boardIds.length === 0) {
      return { totalTasks: 0, doneTasks: 0, overdueTasks: 0, dueSoonTasks: 0, inactiveTasks: 0, tasks: [] };
    }

    const boardInfoMap = new Map(boards.map((b) => [b.id, b]));
    const now = new Date();
    const tzTodayCache = new Map<string, string>();
    const getTodayStr = (tz: string) => {
      if (!tzTodayCache.has(tz)) tzTodayCache.set(tz, localDateStr(now, tz));
      return tzTodayCache.get(tz)!;
    };
    const inactivityCutoff = new Date();
    inactivityCutoff.setDate(inactivityCutoff.getDate() - inactivityDays);

    const tasks = await this.prisma.task.findMany({
      where: { group: { boardId: { in: boardIds }, isArchived: false }, parentId: null },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        group: { select: { name: true, boardId: true } },
        cells: { select: { value: true, column: { select: { id: true, type: true } } } },
        comments: { where: { createdAt: { gte: inactivityCutoff } }, select: { id: true }, take: 1 },
        timeEntries: { where: { createdAt: { gte: inactivityCutoff } }, select: { id: true }, take: 1 },
      },
    });

    const result: MyTaskItem[] = [];
    let doneTasks = 0;
    let overdueTasks = 0;
    let dueSoonTasks = 0;
    let inactiveTasks = 0;

    for (const task of tasks) {
      const board = boardInfoMap.get(task.group.boardId);
      if (!board) continue;

      const personCell = task.cells.find((c) => c.column.type === BoardColumnType.PERSON);
      const dateCell = task.cells.find((c) =>
        c.column.type === BoardColumnType.DATE || c.column.type === BoardColumnType.PLAIN_DATE,
      );
      const statusCell = task.cells.find((c) => c.column.type === BoardColumnType.STATUS);

      const assignedUserIds = this.extractPersonIds(personCell?.value);
      if (!assignedUserIds.includes(targetUserId)) continue;

      const dueDate = this.extractDate(dateCell?.value);
      const status = this.extractStatus(statusCell?.value);
      const isDone = this.isStatusDone(status?.label);

      const timezone = board.timezone;
      const todayStr = getTodayStr(timezone);

      let category: MyTaskItem['category'] = 'on_track';
      let daysOverdue: number | null = null;

      if (isDone) {
        category = 'done';
        doneTasks++;
      } else if (dueDate) {
        const dueDateStr = localDateStr(dueDate, timezone);
        if (dueDateStr < todayStr) {
          const diff = dayDiff(new Date(todayStr), new Date(dueDateStr));
          daysOverdue = diff > 0 ? diff : 1;
          category = 'overdue';
          overdueTasks++;
        } else {
          const diffDays = dayDiff(new Date(dueDateStr), new Date(todayStr));
          if (diffDays >= 0 && diffDays <= upcomingDays) {
            category = 'due_soon';
            dueSoonTasks++;
          }
        }
      } else {
        const hasRecentComment = task.comments.length > 0;
        const hasRecentTimeEntry = task.timeEntries.length > 0;
        if (task.updatedAt < inactivityCutoff && !hasRecentComment && !hasRecentTimeEntry) {
          category = 'inactive';
          inactiveTasks++;
        }
      }

      result.push({
        taskId: task.id,
        taskName: task.name,
        boardId: board.id,
        boardName: board.name,
        workspaceId: board.workspaceId,
        workspaceName: board.workspaceName,
        groupName: task.group.name,
        dueDate: dueDate?.toISOString() ?? null,
        daysOverdue,
        status: status?.label ?? null,
        statusColor: status?.color ?? null,
        category,
      });
    }

    const categoryOrder: Record<string, number> = { overdue: 0, due_soon: 1, inactive: 2, on_track: 3, done: 4 };
    result.sort((a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9));

    return {
      totalTasks: result.length,
      doneTasks,
      overdueTasks,
      dueSoonTasks,
      inactiveTasks,
      tasks: result,
    };
  }

  async getAdminWorkspaceIds(userId: number, filter?: number[]): Promise<number[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        ...(filter?.length ? { workspaceId: { in: filter } } : {}),
      },
      select: { workspaceId: true },
    });
    return memberships.map((m) => m.workspaceId);
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

  private extractPersonIds(value: unknown): number[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.users)) return [];
    return (v.users as any[])
      .map((u) => (typeof u?.id === 'number' ? u.id : typeof u?.id === 'string' ? Number(u.id) : null))
      .filter((id): id is number => id !== null && !isNaN(id));
  }

  private extractStatus(value: unknown): { label: string; color: string } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const v = value as Record<string, unknown>;
    if (typeof v.label === 'string') return { label: v.label, color: (v.color as string) ?? '' };
    return null;
  }

  private isStatusDone(label?: string | null): boolean {
    if (!label) return false;
    const lower = label.toLowerCase().trim();
    return DONE_KEYWORDS.some((kw) => lower.includes(kw));
  }
}
