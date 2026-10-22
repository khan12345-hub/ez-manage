import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  categories: ("overdue" | "due_soon" | "inactive")[];
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
  category: "overdue" | "due_soon" | "on_track" | "done" | "inactive";
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

export interface EmailDraft {
  recipientId: number;
  subject: string;
  body: string;
  taskSnapshot: {
    overdue: { id: number; name: string; daysOverdue: number | null }[];
    dueSoon: { id: number; name: string; dueDate: string | null }[];
    inactive: { id: number; name: string }[];
  };
}

export interface EmailHistoryItem {
  id: number;
  subject: string;
  body: string;
  deliveryStatus: string;
  sentAt: string;
  recipient: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  tone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SendResult {
  recipientId: number;
  recipientName: string;
  recipientEmail: string;
  success: boolean;
  historyId?: number;
  error?: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function getTaskOverview(params?: {
  workspaceIds?: number[];
  inactivityDays?: number;
  upcomingDays?: number;
}): Promise<TaskOverview> {
  const query = new URLSearchParams();
  if (params?.inactivityDays) query.set("inactivityDays", String(params.inactivityDays));
  if (params?.upcomingDays) query.set("upcomingDays", String(params.upcomingDays));
  if (params?.workspaceIds?.length) {
    params.workspaceIds.forEach((id) => query.append("workspaceIds[]", String(id)));
  }
  const { data } = await api.get<TaskOverview>(`/ceo-assistant/overview?${query.toString()}`);
  return data;
}

export async function generateEmailDrafts(params: {
  employeeIds: number[];
  categories?: ("overdue" | "due_soon" | "inactive")[];
  tone?: string;
  inactivityDays?: number;
  upcomingDays?: number;
  templateId?: number;
}): Promise<{ drafts: EmailDraft[] }> {
  const { data } = await api.post<{ drafts: EmailDraft[] }>("/ceo-assistant/generate-drafts", params);
  return data;
}

export async function sendEmails(drafts: {
  recipientId: number;
  subject: string;
  body: string;
}[]): Promise<{ queued: number }> {
  const { data } = await api.post<{ queued: number }>("/ceo-assistant/send", { drafts });
  return data;
}

export async function retryEmail(historyId: number): Promise<{ queued: number }> {
  const { data } = await api.post<{ queued: number }>(`/ceo-assistant/history/${historyId}/retry`);
  return data;
}

export async function getEmailHistory(page = 1, limit = 20): Promise<{
  items: EmailHistoryItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const { data } = await api.get<{ items: EmailHistoryItem[]; total: number; page: number; limit: number }>(
    `/ceo-assistant/history?page=${page}&limit=${limit}`,
  );
  return data;
}

export async function getTemplates(): Promise<EmailTemplate[]> {
  const { data } = await api.get<EmailTemplate[]>("/ceo-assistant/templates");
  return data;
}

export async function saveTemplate(payload: {
  name: string;
  subject: string;
  body: string;
  tone?: string;
  isDefault?: boolean;
}): Promise<EmailTemplate> {
  const { data } = await api.post<EmailTemplate>("/ceo-assistant/templates", payload);
  return data;
}

export async function updateTemplate(
  id: number,
  payload: Partial<{ name: string; subject: string; body: string; tone: string; isDefault: boolean }>,
): Promise<EmailTemplate> {
  const { data } = await api.patch<EmailTemplate>(`/ceo-assistant/templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/ceo-assistant/templates/${id}`);
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export interface MeetingAttendee {
  id: number;
  userId: number;
  meetingId: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Meeting {
  id: number;
  title: string;
  description: string | null;
  meetingLink: string | null;
  scheduledAt: string;
  cancelledAt: string | null;
  createdById: number;
  createdAt: string;
  attendees: MeetingAttendee[];
}

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  meetingLink?: string;
  scheduledAt: string;
  attendeeIds: number[];
}

export async function getMeetings(upcoming = true): Promise<Meeting[]> {
  const { data } = await api.get<Meeting[]>(`/ceo-assistant/meetings`, {
    params: { upcoming: upcoming ? 'true' : 'false' },
  });
  return data;
}

export async function createMeeting(payload: CreateMeetingPayload): Promise<Meeting> {
  const { data } = await api.post<Meeting>(`/ceo-assistant/meetings`, payload);
  return data;
}

export async function cancelMeeting(id: number): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/ceo-assistant/meetings/${id}`);
  return data;
}

export interface UpdateMeetingPayload {
  title?: string;
  description?: string;
  meetingLink?: string;
  scheduledAt?: string;
  attendeeIds?: number[];
}

export async function updateMeeting(id: number, payload: UpdateMeetingPayload): Promise<Meeting> {
  const { data } = await api.patch<Meeting>(`/ceo-assistant/meetings/${id}`, payload);
  return data;
}

// ─── Dashboard Passphrase ─────────────────────────────────────────────────────

export async function getKeyStatus(): Promise<{ hasKey: boolean }> {
  const { data } = await api.get<{ hasKey: boolean }>('/ceo-assistant/settings/key-status');
  return data;
}

export async function setDashboardKey(key: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>('/ceo-assistant/settings/key', { key });
  return data;
}

export async function unlockDashboard(key: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>('/ceo-assistant/unlock', { key });
  return data;
}
