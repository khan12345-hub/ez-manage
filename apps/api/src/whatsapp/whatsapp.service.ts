import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ActivityAction, ActivityEntityType } from 'generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { AutomationEngineService } from '../automations/automation-engine.service';
import { WhatsappTaskUpdatedEvent } from './whatsapp-task-updated.event';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private readonly apiUrl = 'https://graph.facebook.com/v18.0';
  private readonly phoneId = process.env.WHATSAPP_PHONE_ID ?? '';
  private readonly token   = process.env.WHATSAPP_TOKEN ?? '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
    private readonly automationEngine: AutomationEngineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Outbound messaging ──────────────────────────────────────────────────

  async sendToUser(userId: number, message: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { whatsappPhone: true, whatsappEnabled: true },
    });
    if (!user?.whatsappEnabled || !user.whatsappPhone) return;
    await this.send(user.whatsappPhone, message, userId);
  }

  async send(phone: string, message: string, userId?: number): Promise<void> {
    if (!this.phoneId || !this.token) {
      this.logger.warn('WhatsApp env vars not set — skipping send');
      return;
    }

    const body = {
      messaging_product: 'whatsapp',
      to: phone.replace(/\D/g, ''),
      type: 'text',
      text: { body: message },
    };

    try {
      const res = await fetch(`${this.apiUrl}/${this.phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody?.error?.message ?? `WhatsApp API error ${res.status}`;
        this.logger.error(`WhatsApp failed to ${phone}: ${errMsg}`);
        if (userId) {
          await this.prisma.whatsappLog.create({
            data: { userId, direction: 'OUT', body: message, status: 'failed' },
          }).catch(() => {});
        }
        throw new Error(errMsg);
      }

      this.logger.log(`WhatsApp sent to ${phone}`);
      if (userId) {
        await this.prisma.whatsappLog.create({
          data: { userId, direction: 'OUT', body: message, status: 'sent' },
        });
      }
    } catch (err) {
      this.logger.error('WhatsApp send error', err);
      throw err; // re-throw so callers can handle
    }
  }

  // ─── Inbound message router ──────────────────────────────────────────────

  async handleInbound(from: string, text: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { whatsappPhone: { contains: from.slice(-9) } },
      select: { id: true, whatsappSession: true },
    });

    if (!user) return 'Number not linked to any Ez-Manage account.';

    await this.prisma.whatsappLog.create({
      data: { userId: user.id, direction: 'IN', body: text, status: 'received' },
    });

    const raw   = text.trim();
    const cmd   = raw.toUpperCase();
    const session = user.whatsappSession;

    // ── Number selection (state machine) ────────────────────────────────────
    if (/^\d+$/.test(cmd)) {
      const num = parseInt(cmd, 10);
      if (session?.state === 'selecting-task')  return this.selectTask(user.id, num, session);
      if (session?.state === 'selecting-board') return this.selectBoard(user.id, num, session);
    }

    // ── Global commands ──────────────────────────────────────────────────────
    if (cmd === 'HELP')   return this.helpText();
    if (cmd === 'STOP')   { await this.prisma.user.update({ where: { id: user.id }, data: { whatsappEnabled: false } }); return 'Notifications off. Reply START to re-enable.'; }
    if (cmd === 'START')  { await this.prisma.user.update({ where: { id: user.id }, data: { whatsappEnabled: true } });  return 'Notifications enabled.'; }
    if (cmd === 'BOARDS') return this.listBoards(user.id);
    if (cmd === 'TODAY')  return this.listTodayTasks(user.id);
    if (cmd === 'MY')     return this.listMyTasks(user.id);
    if (cmd === 'TASKS')  return this.listTasks(user.id);
    if (cmd.startsWith('BOARD ')) return this.switchBoard(user.id, raw.slice(6).trim());

    // ── Board-level commands ─────────────────────────────────────────────────
    const boardId = session?.lastBoardId ?? null;
    if (!boardId) return '📋 No board selected.\n\nReply BOARDS to see your boards, or open one in Ez-Manage.';

    if (cmd.startsWith('NEW '))   return this.createTask(user.id, boardId, raw.slice(4).trim());
    if (cmd === 'LIST STATUS')    return this.listStatuses(boardId);
    if (cmd === 'LIST GROUPS')    return this.listGroups(boardId);
    if (cmd === 'MEMBERS')        return this.listMembers(boardId);
    if (cmd === 'ALL')            return this.listBoardTasks(user.id, boardId);

    // ── Task-level commands ──────────────────────────────────────────────────
    const taskId = session?.lastTaskId ?? null;
    if (!taskId) return '📌 No task selected.\n\nReply TODAY, MY, or TASKS to see your tasks, then pick a number.';

    if (cmd === 'INFO')            return this.taskInfo(taskId, boardId);
    if (cmd === 'DONE')            return this.markDone(user.id, taskId, boardId);
    if (cmd === 'EXTEND')          return this.extendDate(user.id, taskId, boardId);
    if (cmd.startsWith('STATUS ')) return this.changeStatus(user.id, taskId, boardId, raw.slice(7).trim());
    if (cmd.startsWith('COMMENT '))return this.addComment(user.id, taskId, boardId, raw.slice(8));
    if (cmd.startsWith('MOVE '))   return this.moveToGroup(user.id, taskId, boardId, raw.slice(5).trim());

    return 'Unknown command. Reply HELP for all commands.';
  }

  // ── State machine: select task by number ──────────────────────────────────

  private async selectTask(userId: number, num: number, session: any): Promise<string> {
    const list: any[] = Array.isArray(session.taskList) ? session.taskList : [];
    const item = list[num - 1];
    if (!item) return `❌ Invalid number. Reply a number between 1 and ${list.length}.`;

    await this.prisma.whatsappSession.update({
      where: { userId },
      data: { lastTaskId: item.id, lastBoardId: item.boardId, state: null },
    });

    const due = item.dueDate ? `\nDue: ${item.dueDate}` : '';
    return [
      `✅ *${item.name}*`,
      `Board: ${item.boardName} | Group: ${item.groupName}`,
      `Status: ${item.statusLabel ?? 'Not set'}${due}`,
      '',
      'What to do?',
      'COMMENT {text} · STATUS {label} · DONE · EXTEND · INFO · MOVE {group}',
    ].join('\n');
  }

  // ── State machine: select board by number ─────────────────────────────────

  private async selectBoard(userId: number, num: number, session: any): Promise<string> {
    const list: any[] = Array.isArray(session.boardList) ? session.boardList : [];
    const item = list[num - 1];
    if (!item) return `❌ Invalid number. Reply a number between 1 and ${list.length}.`;

    await this.prisma.whatsappSession.update({
      where: { userId },
      data: { lastBoardId: item.id, lastTaskId: null, state: null },
    });

    return `✅ Switched to board: *${item.name}*\n\nReply ALL to list tasks, or NEW {name} to create one.`;
  }

  // ── BOARDS: list user's boards ────────────────────────────────────────────

  private async listBoards(userId: number): Promise<string> {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      include: { board: { select: { id: true, name: true } } },
      take: 15,
    });

    if (!memberships.length) return 'You are not a member of any boards.';

    const boards = memberships.map((m) => ({ id: m.board.id, name: m.board.name }));

    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { state: 'selecting-board', boardList: boards },
      create: { userId, state: 'selecting-board', boardList: boards },
    });

    const lines = boards.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
    return `📋 *Your Boards:*\n${lines}\n\nReply a number to switch board.`;
  }

  // ── BOARD {name}: switch board ────────────────────────────────────────────

  private async switchBoard(userId: number, name: string): Promise<string> {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      include: { board: { select: { id: true, name: true } } },
    });

    const found = memberships.find((m) =>
      m.board.name.toLowerCase().includes(name.toLowerCase()),
    );
    if (!found) return `❌ No board matching "${name}". Reply BOARDS to see all boards.`;

    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { lastBoardId: found.board.id, lastTaskId: null, state: null },
      create: { userId, lastBoardId: found.board.id },
    });

    return `✅ Switched to board: *${found.board.name}*\n\nReply ALL to list tasks, or NEW {name} to create one.`;
  }

  // ── TODAY: tasks due today ────────────────────────────────────────────────

  private async listTodayTasks(userId: number): Promise<string> {
    const today = new Date().toISOString().split('T')[0];

    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      select: { boardId: true },
    });
    const boardIds = memberships.map((m) => m.boardId);

    const dateCols = await this.prisma.boardColumn.findMany({
      where: { boardId: { in: boardIds }, type: 'DATE' },
      select: { id: true, boardId: true, board: { select: { name: true } } },
    });

    const cells = await this.prisma.taskCell.findMany({
      where: {
        columnId: { in: dateCols.map((c) => c.id) },
        value: { path: [], string_contains: today },
      },
      include: {
        task: {
          include: {
            group: true,
            cells: { include: { column: { select: { type: true } } } },
          },
        },
      },
      take: 10,
    });

    if (!cells.length) return `📅 No tasks due today (${today}).`;

    const items = cells.map((cell) => {
      const colInfo = dateCols.find((c) => c.id === cell.columnId);
      const statusCell = (cell.task.cells as any[]).find((c: any) => c.column?.type === 'STATUS');
      const statusLabel = (statusCell?.value as any)?.label ?? 'No status';
      return {
        id:          cell.task.id,
        name:        cell.task.name,
        boardId:     colInfo?.boardId ?? 0,
        boardName:   colInfo?.board.name ?? '',
        groupName:   cell.task.group.name,
        statusLabel,
        dueDate:     today,
      };
    });

    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { state: 'selecting-task', taskList: items },
      create: { userId, state: 'selecting-task', taskList: items },
    });

    const lines = items.map((t, i) => `${i + 1}. ${t.name} [${t.boardName}] — ${t.statusLabel}`).join('\n');
    return `📅 *Tasks due today (${today}):*\n${lines}\n\nReply a number to select a task.`;
  }

  // ── MY: tasks assigned to me ──────────────────────────────────────────────

  private async listMyTasks(userId: number): Promise<string> {
    const personCols = await this.prisma.boardColumn.findMany({
      where: {
        type: 'PERSON',
        board: { members: { some: { userId } } },
      },
      select: { id: true, boardId: true, board: { select: { name: true } } },
      take: 20,
    });

    const cells = await this.prisma.taskCell.findMany({
      where: {
        columnId: { in: personCols.map((c) => c.id) },
        value: { path: [], array_contains: [{ userId }] },
      },
      include: {
        task: {
          include: {
            group: true,
            cells: { include: { column: { select: { type: true } } } },
          },
        },
      },
      take: 10,
    });

    if (!cells.length) return '📌 No tasks currently assigned to you.';

    const items = cells.map((cell) => {
      const colInfo = personCols.find((c) => c.id === cell.columnId);
      const statusCell = (cell.task.cells as any[]).find((c: any) => c.column?.type === 'STATUS');
      const statusLabel = (statusCell?.value as any)?.label ?? 'No status';
      return {
        id:          cell.task.id,
        name:        cell.task.name,
        boardId:     colInfo?.boardId ?? 0,
        boardName:   colInfo?.board.name ?? '',
        groupName:   cell.task.group.name,
        statusLabel,
        dueDate:     null,
      };
    });

    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { state: 'selecting-task', taskList: items },
      create: { userId, state: 'selecting-task', taskList: items },
    });

    const lines = items.map((t, i) => `${i + 1}. ${t.name} [${t.boardName}] — ${t.statusLabel}`).join('\n');
    return `👤 *Tasks assigned to you:*\n${lines}\n\nReply a number to select a task.`;
  }

  // ── ALL: all tasks in current board ──────────────────────────────────────

  private async listBoardTasks(userId: number, boardId: number): Promise<string> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { name: true },
    });

    const tasks = await this.prisma.task.findMany({
      where: { group: { boardId } },
      include: {
        group: true,
        cells: { include: { column: { select: { type: true } } } },
      },
      orderBy: { order: 'asc' },
      take: 15,
    });

    if (!tasks.length) return `📋 No tasks found in *${board?.name}*.`;

    const items = tasks.map((t) => {
      const statusCell = (t.cells as any[]).find((c: any) => c.column?.type === 'STATUS');
      const statusLabel = (statusCell?.value as any)?.label ?? 'No status';
      return { id: t.id, name: t.name, boardId, boardName: board?.name ?? '', groupName: t.group.name, statusLabel, dueDate: null };
    });

    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { state: 'selecting-task', taskList: items },
      create: { userId, state: 'selecting-task', taskList: items },
    });

    const lines = items.map((t, i) => `${i + 1}. ${t.name} [${t.groupName}] — ${t.statusLabel}`).join('\n');
    return `📋 *Tasks in ${board?.name}:*\n${lines}\n\nReply a number to select a task.`;
  }

  // ── INFO: selected task details ───────────────────────────────────────────

  private async taskInfo(taskId: number, boardId: number): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        group: { select: { name: true } },
        cells: {
          include: { column: { select: { type: true, name: true } } },
        },
      },
    });
    if (!task) return '❌ Task not found.';

    const board = await this.prisma.board.findUnique({ where: { id: boardId }, select: { name: true } });

    let status = 'Not set', dueDate = 'Not set', assignees = 'None';
    for (const cell of task.cells) {
      if (cell.column.type === 'STATUS' && cell.value) status = (cell.value as any).label ?? status;
      if (cell.column.type === 'DATE'   && cell.value) dueDate = String(cell.value).split('T')[0];
      if (cell.column.type === 'PERSON' && Array.isArray(cell.value)) {
        const ids: number[] = (cell.value as any[]).map((v: any) => v.userId).filter(Boolean);
        if (ids.length) {
          const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { firstName: true, lastName: true } });
          assignees = users.map((u) => `${u.firstName} ${u.lastName}`.trim()).join(', ');
        }
      }
    }

    return [
      `📌 *${task.name}*`,
      `Board: ${board?.name} | Group: ${task.group.name}`,
      `Status: ${status}`,
      `Due: ${dueDate}`,
      `Assigned: ${assignees}`,
      '',
      'COMMENT {text} · STATUS {label} · DONE · EXTEND · MOVE {group}',
    ].join('\n');
  }

  // ── MEMBERS: list board members ───────────────────────────────────────────

  private async listMembers(boardId: number): Promise<string> {
    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!members.length) return 'No members found on this board.';
    const lines = members.map((m, i) => `${i + 1}. ${m.user.firstName} ${m.user.lastName} (${m.role})`).join('\n');
    return `👥 *Board Members:*\n${lines}`;
  }

  /** Update last-task context when a notification is sent. */
  async updateSession(userId: number, taskId: number, boardId: number): Promise<void> {
    await this.prisma.whatsappSession.upsert({
      where:  { userId },
      update: { lastTaskId: taskId, lastBoardId: boardId },
      create: { userId, lastTaskId: taskId, lastBoardId: boardId },
    });
  }

  // ─── Command handlers ────────────────────────────────────────────────────

  private async markDone(userId: number, taskId: number, boardId: number): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, groupId: true },
    });
    if (!task) return 'Task not found.';

    const statusCol = await this.prisma.boardColumn.findFirst({
      where: { boardId, type: 'STATUS' },
      select: { id: true },
    });
    if (!statusCol) return 'No status column found on this board.';

    const doneOption = await this.prisma.statusOption.findFirst({
      where: { columnId: statusCol.id, isArchived: false, label: { contains: 'done', mode: 'insensitive' } },
      select: { id: true, label: true, color: true },
    });
    if (!doneOption) return 'No "Done" status option found. Use STATUS {label} to set a specific status.';

    const cell = await this.prisma.taskCell.upsert({
      where:  { taskId_columnId: { taskId, columnId: statusCol.id } },
      update: { value: { label: doneOption.label, color: doneOption.color } },
      create: { taskId, columnId: statusCol.id, value: { label: doneOption.label, color: doneOption.color } },
    });

    // Activity log
    await this.activityLogs.log({
      boardId, taskId, groupId: task.groupId, userId,
      entityType: ActivityEntityType.TASK_CELL,
      entityId: cell.id,
      action: ActivityAction.UPDATED,
      metadata: { source: 'whatsapp', columnId: statusCol.id, newStatus: doneOption.label },
    }).catch(() => {});

    // Automation trigger
    await this.automationEngine
      .handleStatusChanged(taskId, boardId, statusCol.id, doneOption.id)
      .catch(() => {});

    // Real-time SSE notification to board members
    this.emitBoardUpdate(userId, taskId, boardId, `"${task.name}" marked as ${doneOption.label} via WhatsApp`);

    return `✓ "${task.name}" marked as ${doneOption.label}.`;
  }

  private async addComment(userId: number, taskId: number, boardId: number, text: string): Promise<string> {
    if (!text.trim()) return 'Please include comment text. E.g. COMMENT your message here';

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, groupId: true },
    });
    if (!task) return 'Task not found.';

    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId, content: text.trim() },
    });

    await this.activityLogs.log({
      boardId, taskId, groupId: task.groupId, userId,
      entityType: ActivityEntityType.TASK,
      entityId: comment.id,
      action: ActivityAction.UPDATED,
      metadata: { source: 'whatsapp', commentPreview: text.trim().slice(0, 80) },
    }).catch(() => {});

    this.emitBoardUpdate(userId, taskId, boardId, `Comment added to "${task.name}" via WhatsApp`);

    return '✓ Comment added.';
  }

  private async extendDate(userId: number, taskId: number, boardId: number): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, groupId: true },
    });
    if (!task) return 'Task not found.';

    const dateCol = await this.prisma.boardColumn.findFirst({
      where: { boardId, type: 'DATE' },
      select: { id: true },
    });
    if (!dateCol) return 'No date column found on this board.';

    const existing = await this.prisma.taskCell.findUnique({
      where: { taskId_columnId: { taskId, columnId: dateCol.id } },
      select: { value: true },
    });

    const currentDate = existing?.value ? new Date(existing.value as string) : new Date();
    if (isNaN(currentDate.getTime())) currentDate.setTime(Date.now());
    currentDate.setDate(currentDate.getDate() + 1);
    const newDateStr = currentDate.toISOString().split('T')[0];

    const cell = await this.prisma.taskCell.upsert({
      where:  { taskId_columnId: { taskId, columnId: dateCol.id } },
      update: { value: newDateStr },
      create: { taskId, columnId: dateCol.id, value: newDateStr },
    });

    await this.activityLogs.log({
      boardId, taskId, groupId: task.groupId, userId,
      entityType: ActivityEntityType.TASK_CELL,
      entityId: cell.id,
      action: ActivityAction.UPDATED,
      metadata: { source: 'whatsapp', columnId: dateCol.id, newDate: newDateStr },
    }).catch(() => {});

    this.emitBoardUpdate(userId, taskId, boardId, `Due date extended to ${newDateStr} for "${task.name}" via WhatsApp`);

    return `✓ Due date extended to ${newDateStr} for "${task.name}".`;
  }

  private async changeStatus(userId: number, taskId: number, boardId: number, label: string): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, groupId: true },
    });
    if (!task) return 'Task not found.';

    const statusCol = await this.prisma.boardColumn.findFirst({
      where: { boardId, type: 'STATUS' },
      select: { id: true },
    });
    if (!statusCol) return 'No status column found on this board.';

    const option = await this.prisma.statusOption.findFirst({
      where: { columnId: statusCol.id, isArchived: false, label: { contains: label, mode: 'insensitive' } },
      select: { id: true, label: true, color: true },
    });
    if (!option) return `Status "${label}" not found. Check the board for available statuses.`;

    const cell = await this.prisma.taskCell.upsert({
      where:  { taskId_columnId: { taskId, columnId: statusCol.id } },
      update: { value: { label: option.label, color: option.color } },
      create: { taskId, columnId: statusCol.id, value: { label: option.label, color: option.color } },
    });

    await this.activityLogs.log({
      boardId, taskId, groupId: task.groupId, userId,
      entityType: ActivityEntityType.TASK_CELL,
      entityId: cell.id,
      action: ActivityAction.UPDATED,
      metadata: { source: 'whatsapp', columnId: statusCol.id, newStatus: option.label },
    }).catch(() => {});

    await this.automationEngine
      .handleStatusChanged(taskId, boardId, statusCol.id, option.id)
      .catch(() => {});

    this.emitBoardUpdate(userId, taskId, boardId, `"${task.name}" status changed to ${option.label} via WhatsApp`);

    return `✓ "${task.name}" status changed to ${option.label}.`;
  }

  private async moveToGroup(userId: number, taskId: number, boardId: number, groupName: string): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true, groupId: true },
    });
    if (!task) return 'Task not found.';

    const group = await this.prisma.group.findFirst({
      where: { boardId, name: { contains: groupName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (!group) return `Group "${groupName}" not found on this board.`;

    await this.prisma.task.update({
      where: { id: taskId },
      data: { groupId: group.id },
    });

    await this.activityLogs.log({
      boardId, taskId, groupId: task.groupId, userId,
      entityType: ActivityEntityType.TASK,
      entityId: taskId,
      action: ActivityAction.UPDATED,
      metadata: { source: 'whatsapp', movedToGroup: group.name },
    }).catch(() => {});

    this.emitBoardUpdate(userId, taskId, boardId, `"${task.name}" moved to "${group.name}" via WhatsApp`);

    return `✓ "${task.name}" moved to group "${group.name}".`;
  }

  private async listTasks(userId: number): Promise<string> {
    const tasks = await this.prisma.task.findMany({
      where: { createdById: userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, group: { select: { name: true } } },
    });
    if (!tasks.length) return 'No tasks found.';
    return tasks.map((t, i) => `${i + 1}. ${t.name} [${t.group.name}]`).join('\n');
  }

  private async createTask(userId: number, boardId: number, name: string): Promise<string> {
    if (!name) return 'Please provide a task name. Example: NEW Fix login bug';

    const group = await this.prisma.group.findFirst({
      where: { boardId },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    });
    if (!group) return 'No groups found on this board.';

    const maxTask = await this.prisma.task.findFirst({
      where: { groupId: group.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const newOrder = (maxTask?.order ?? 0) + 1000;

    const task = await this.prisma.task.create({
      data: { name, groupId: group.id, createdById: userId, order: newOrder },
      select: { id: true, name: true },
    });

    await this.activityLogs.log({
      boardId, taskId: task.id, groupId: group.id, userId,
      entityType: ActivityEntityType.TASK,
      entityId: task.id,
      action: ActivityAction.CREATED,
      metadata: { source: 'whatsapp' },
    }).catch(() => {});

    this.emitBoardUpdate(userId, task.id, boardId, `Task "${task.name}" created via WhatsApp`);

    return `✓ Task "${task.name}" created in "${group.name}".`;
  }

  private async listStatuses(boardId: number): Promise<string> {
    const statusCol = await this.prisma.boardColumn.findFirst({
      where: { boardId, type: 'STATUS' },
      select: { id: true },
    });
    if (!statusCol) return 'No status column found on this board.';

    const options = await this.prisma.statusOption.findMany({
      where: { columnId: statusCol.id, isArchived: false },
      orderBy: { order: 'asc' },
      select: { label: true },
    });
    if (!options.length) return 'No statuses defined.';
    return '*Available statuses:*\n' + options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
  }

  private async listGroups(boardId: number): Promise<string> {
    const groups = await this.prisma.group.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
      select: { name: true },
    });
    if (!groups.length) return 'No groups found on this board.';
    return '*Groups:*\n' + groups.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
  }

  // ─── Real-time board update notification ─────────────────────────────────

  private emitBoardUpdate(actorUserId: number, taskId: number, boardId: number, description: string): void {
    this.eventEmitter.emit(
      'whatsapp.task.updated',
      new WhatsappTaskUpdatedEvent(taskId, boardId, actorUserId, description),
    );
  }

  // ─── Help text ───────────────────────────────────────────────────────────

  private helpText(): string {
    return [
      '*Ez-Manage WhatsApp Bot*',
      '',
      '*📋 Boards*',
      'BOARDS — list your boards',
      'BOARD {name} — switch to a board',
      '',
      '*📌 Browse Tasks*',
      'TODAY — tasks due today',
      'MY — tasks assigned to you',
      'ALL — all tasks in current board',
      'TASKS — your recent tasks',
      '{number} — select task from list',
      '',
      '*✅ Task Actions*',
      'INFO — task details',
      'STATUS {label} — change status',
      'COMMENT {text} — add comment',
      'DONE — mark as done',
      'EXTEND — push due date +1 day',
      'MOVE {group} — move to group',
      '',
      '*⚙️ Board Tools*',
      'NEW {name} — create a task',
      'LIST STATUS — show statuses',
      'LIST GROUPS — show groups',
      'MEMBERS — show board members',
      '',
      '*🔔 Notifications*',
      'STOP — disable notifications',
      'START — enable notifications',
    ].join('\n');
  }
}
