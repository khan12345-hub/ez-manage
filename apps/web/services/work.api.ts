import { api } from "@/lib/api";

/* ─── types (mirror apps/api/src/work) ─────────────────────────────────── */

export type StatusCategory = "NOT_STARTED" | "ACTIVE" | "DONE";
export type WorkPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface WorkUser {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
}

export interface WorkStatus {
  id: number;
  name: string;
  color: string;
  category: StatusCategory;
  order: number;
  spaceId: number | null;
  folderId: number | null;
  listId: number | null;
}

export interface WorkListNode {
  id: number;
  uid: string;
  name: string;
  color: string | null;
  order: number;
  folderId: number | null;
  openTaskCount: number;
}

export interface WorkFolderNode {
  id: number;
  uid: string;
  name: string;
  order: number;
  lists: WorkListNode[];
}

export interface WorkSpaceNode {
  id: number;
  uid: string;
  name: string;
  color: string;
  icon: string | null;
  isPrivate: boolean;
  order: number;
  folders: WorkFolderNode[];
  lists: WorkListNode[];
}

export interface WorkAccessFlags {
  /** comment without editing ("Comment" space permission); missing = same as canEdit */
  canComment?: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export interface WorkTree {
  access: WorkAccessFlags;
  spaces: WorkSpaceNode[];
}

export interface WorkTask {
  id: number;
  uid: string;
  listId: number;
  statusId: number | null;
  parentId: number | null;
  name: string;
  priority: WorkPriority | null;
  startDate: string | null;
  dueDate: string | null;
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: number;
  timeEstimate: number | null;
  assignees: WorkUser[];
  tags: WorkTag[];
  subtaskCount: number;
  commentCount: number;
}

export interface WorkTag {
  id: number;
  name: string;
  color: string;
}

export interface WorkChecklistItem {
  id: number;
  name: string;
  done: boolean;
  order: number;
  assignee: WorkUser | null;
}

export interface WorkChecklist {
  id: number;
  name: string;
  order: number;
  items: WorkChecklistItem[];
}

export interface WorkLinkedTask {
  linkId: number;
  task: {
    id: number;
    uid: string;
    name: string;
    completedAt: string | null;
    status: { name: string; color: string; category: StatusCategory } | null;
    list: { name: string };
  };
}

export interface WorkTimeEntry {
  id: number;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  seconds: number;
  running: boolean;
  note: string | null;
  billable: boolean;
  user: WorkUser;
}

export interface WorkActivity {
  id: number;
  action: string;
  fromValue: unknown;
  toValue: unknown;
  createdAt: string;
  user: WorkUser;
}

export interface WorkListDetail {
  id: number;
  uid: string;
  name: string;
  description: string | null;
  color: string | null;
  spaceId: number;
  folderId: number | null;
  space: { id: number; uid: string; name: string; color: string; workspaceId: number; workspace: { uid: string; name: string } };
  folder: { id: number; uid: string; name: string } | null;
  statuses: WorkStatus[];
  members: WorkUser[];
  access: WorkAccessFlags;
}

export interface WorkTaskDetail extends WorkTask {
  description: string | null;
  createdBy: WorkUser;
  parent: { id: number; uid: string; name: string } | null;
  list: { id: number; uid: string; name: string; spaceId: number; folderId: number | null; space: { name: string; uid: string } };
  subtasks: WorkTask[];
  statuses: WorkStatus[];
  access: WorkAccessFlags;
  checklists: WorkChecklist[];
  links: { waitingOn: WorkLinkedTask[]; blocking: WorkLinkedTask[]; linked: WorkLinkedTask[] };
  time: { totalSeconds: number; myRunning: { id: number; startedAt: string } | null };
  /** Tasks in Multiple Lists: the other lists this task also shows in */
  otherLists?: WorkOtherList[];
}
export interface WorkOtherList { id: number; uid: string; name: string; space: { id: number; name: string; color: string }; folder: { name: string } | null }
export interface WorkTaskMine { following: boolean; favorite: boolean; followedComments: number[] }

export interface WorkComment {
  id: number;
  taskId: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user: WorkUser;
  assignee: WorkUser | null;
  attachments?: WorkAttachment[];
  reactions?: WorkReaction[];
}

export interface WorkReaction {
  emoji: string;
  userId: number;
  user: { id: number; firstName: string; lastName: string };
}
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏", "🔥", "✅", "🚀", "💯", "👏", "😮"];
export type NotificationKind = "mention" | "assigned" | "assigned_comment" | "reply" | "comment" | "reaction" | "status" | "overdue";
export interface NotificationPref { kind: NotificationKind; inbox: boolean; email: boolean; browser: boolean }

export interface WorkAttachment {
  id: number;
  source: "task" | "comment" | "description";
  commentId: number | null;
  createdAt: string;
  uploadedBy: WorkUser;
  file: { id: number; fileName: string; mimeType: string; fileSize: number; url: string };
}

export interface WorkWebLink {
  id: number;
  url: string;
  title: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  previewAt?: string | null;
  createdAt: string;
  createdBy: WorkUser;
}

export type InboxTab = "primary" | "later" | "cleared";
export interface InboxItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: number | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
  clearedAt: string | null;
  snoozedUntil: string | null;
}

export interface MyWorkTask extends WorkTask {
  status: { id: number; name: string; color: string; category: StatusCategory } | null;
  list: { id: number; uid: string; name: string; space: { name: string; color: string } };
}

export interface TaskInput {
  name?: string;
  statusId?: number | null;
  parentId?: number;
  priority?: WorkPriority | null;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeIds?: number[];
  description?: string | null;
  listId?: number;
  order?: number;
  timeEstimate?: number | null;
  tagIds?: number[];
}

/* ─── calls ────────────────────────────────────────────────────────────── */

const get = async <T,>(url: string) => (await api.get<T>(url)).data;
const post = async <T,>(url: string, body?: unknown) => (await api.post<T>(url, body)).data;
const patch = async <T,>(url: string, body?: unknown) => (await api.patch<T>(url, body)).data;
const put = async <T,>(url: string, body?: unknown) => (await api.put<T>(url, body)).data;
const del = async <T,>(url: string, config?: { data?: unknown }) => (await api.delete<T>(url, config)).data;

export type WorkRole = "OWNER" | "ADMIN" | "MEMBER" | "LIMITED_MEMBER" | "GUEST";
export const WORK_ROLE_META: Record<WorkRole, { label: string; hint: string }> = {
  OWNER: { label: "Owner", hint: "Full control of Work in this workspace." },
  ADMIN: { label: "Admin", hint: "Can manage spaces, people and Work settings." },
  MEMBER: { label: "Member", hint: "Can access all public spaces in Work." },
  LIMITED_MEMBER: { label: "Limited Member", hint: "Can only access spaces shared with them." },
  GUEST: { label: "Guest", hint: "View only. Can only see spaces shared with them." },
};
export interface WorkPeople {
  me: { role: WorkRole | null; canManage: boolean };
  members: { role: WorkRole; createdAt: string; user: WorkUser }[];
  invites: { id: number; email: string; workRole: WorkRole | null; createdAt: string; expiresAt: string }[];
}
export type InviteResult = { email: string; status: "added" | "invited" | "already_member" | "already_invited" };

export interface WorkOverviewList { id: number; uid: string; name: string; color: string | null; folder: { id: number; uid: string; name: string } | null; total: number; done: number; open: number; overdue: number }
export interface WorkOverview {
  kind: "space" | "folder";
  space: { id: number; uid: string; name: string; color: string; icon?: string | null; description?: string | null; isPrivate: boolean; workspace: { uid: string; name: string } };
  folder: { id: number; uid: string; name: string } | null;
  folders: { id: number; uid: string; name: string }[];
  lists: WorkOverviewList[];
  access: WorkAccessFlags;
}

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "dropdown" | "labels" | "checkbox" | "email" | "phone" | "url" | "rating" | "progress" | "people";
export interface FieldOption { id: string; name: string; color: string }
export interface WorkField { id: number; spaceId: number; name: string; type: FieldType; config: { options?: FieldOption[]; currency?: string; decimals?: number } | null; order: number }
export type FieldValues = Record<number, Record<number, unknown>>;

export interface WorkReminder {
  id: number;
  title: string;
  description: string | null;
  remindAt: string;
  firedAt: string | null;
  doneAt: string | null;
  createdAt: string;
  user: WorkUser;
  assignee: WorkUser;
  task: { uid: string; name: string; list: { uid: string } } | null;
}

export type StatsKind = "list" | "folder" | "space";
export interface StatsTask {
  id: number; uid: string; name: string; priority: WorkPriority | null; dueDate: string | null; completedAt: string | null;
  list: { uid: string; name: string }; status: { id: number; name: string; color: string; category: string } | null; assignees: WorkUser[];
  overdue?: boolean;
}
export interface WorkStats {
  kind: StatsKind;
  name: string;
  totals: { total: number; done: number; open: number; inProgress: number; unassigned: number; overdue: number };
  byStatus: { name: string; color: string; category: string; count: number }[];
  byAssignee: { user: WorkUser; total: number; open: number; done: number }[];
  completedThisWeek: StatsTask[];
  dueThisWeek: StatsTask[];
  activity: { id: number; action: string; fromValue: unknown; toValue: unknown; createdAt: string; user: WorkUser; task: { uid: string; name: string; list: { name: string } } }[];
  timeByUser: { user: WorkUser; seconds: number }[];
  files: (WorkAttachment & { task: { uid: string; name: string } })[];
}

export type SpacePermission = "full" | "edit" | "comment" | "view";
export interface SpaceTemplate { id: string; name: string; category: string; description: string; color: string; icon: string; folders: { name: string; lists: string[] }[]; lists: string[]; statuses: { name: string; color: string }[] }

export interface WorkPerson { role: WorkRole; title: string | null; timezone: string | null; managerId: number | null; user: WorkUser; online: boolean; teamIds: number[] }
export interface WorkTeam { id: number; name: string; color: string; createdAt: string; memberIds: number[] }
export interface WorkDirectory { people: WorkPerson[]; teams: WorkTeam[] }
export interface ProfileTask {
  id: number; uid: string; name: string; priority: WorkPriority | null; dueDate: string | null; startDate: string | null; completedAt: string | null;
  status: { name: string; color: string; category: string } | null; list: { uid: string; name: string; space: { name: string } }; assignees: WorkUser[];
}
export interface FocusRow { task: { id: number; uid: string | null; name: string; status: { color: string; category: string } | null }; seconds: number; pct: number }
export interface WorkProfile {
  member: { role: WorkRole; title: string | null; timezone: string | null; since: string; user: WorkUser; status: { emoji: string | null; text: string | null } };
  online: boolean;
  manager: { title: string | null; user: WorkUser } | null;
  reports: { title: string | null; user: WorkUser }[];
  teams: { id: number; name: string; color: string }[];
  counts: { tasks: number; comments: number };
  priorities: ProfileTask[];
  focused: FocusRow[];
  canEdit: boolean;
  canManage: boolean;
}
export interface ProfileTasks { today: ProfileTask[]; overdue: ProfileTask[]; next: ProfileTask[]; unscheduled: ProfileTask[]; done: ProfileTask[]; delegated: ProfileTask[] }
export interface ProfileComment { id: number; content: string; createdAt: string; resolvedAt: string | null; taskId: number; user: WorkUser; _count: { replies: number }; task: { uid: string; name: string; list: { uid: string; name: string; space: { name: string } } } }
export interface ProfileActivity { id: number; action: string; fromValue: unknown; toValue: unknown; createdAt: string; user: WorkUser; task: { uid: string; name: string; status: { color: string; category: string } | null; list: { uid: string; name: string; space: { name: string } } } }
export interface WorkAnalytics { day: string; hours: number[]; people: { user: WorkUser; title: string | null; online: boolean; active: boolean; focused: FocusRow[] }[] }

export interface WorkWorkspaceInfo { id: number; uid: string; name: string; color?: string; avatarUrl?: string | null; role: WorkRole }

export type AutomationTriggerType = "task_created" | "status_changed" | "assignee_added" | "priority_changed" | "due_date_changed" | "comment_added" | "task_moved";
export type AutomationActionType = "set_status" | "set_priority" | "add_assignees" | "remove_assignees" | "set_due_date" | "add_tag" | "add_comment" | "create_subtask" | "move_to_list" | "archive" | "notify";
export interface AutomationTrigger { type: AutomationTriggerType; from?: string | null; to?: string | null; userId?: number | null }
export interface AutomationCondition { field: "priority" | "assignee" | "tag"; op: "is" | "is_not"; value: string | number }
export interface AutomationAction { type: AutomationActionType; status?: string; priority?: string | null; userIds?: number[]; days?: number; tagId?: number; text?: string; name?: string; listId?: number; message?: string }
export interface WorkAutomation {
  id: number; name: string; spaceId: number; folderId: number | null; listId: number | null;
  trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[];
  enabled: boolean; runCount: number; lastRunAt: string | null; createdAt: string; createdBy: WorkUser; inherited: boolean;
}
export interface WorkAutomationRun { id: number; taskId: number | null; ok: boolean; message: string | null; createdAt: string }

export interface ChatFile { id: number; name: string; url: string; mime: string; size: number }
export interface ChatMessage {
  id: number; channelId: number; parentId: number | null; kind: "message" | "post" | "system"; title: string | null; postType: string | null;
  content: string; mentionIds: number[]; files: ChatFile[]; replyCount: number; lastReplyAt: string | null; alsoInChannel: boolean;
  pinnedAt: string | null; editedAt: string | null; deletedAt: string | null; createdAt: string; user: WorkUser;
  reactions: { emoji: string; userIds: number[] }[]; saved: boolean; mine: boolean;
  assigneeId: number | null; resolvedAt: string | null; assignee: WorkUser | null;
  task: { uid: string; name: string; completedAt: string | null; list: { uid: string } } | null;
  forwarded: { messageId: number; authorName: string; authorAvatar: string | null; channelUid: string; channelName: string | null; title: string | null; content: string; createdAt: string } | null;
  channel?: { uid: string; name: string | null; kind: string }; reason?: "mention" | "reply";
}
export type ChatPermission = "full" | "edit" | "comment" | "view";
export type ChatNotify = "all" | "mentions" | "none";
export type ChatSection = { id: number; name: string; position: number };
export type ChatSearchHit = ChatMessage & { channel: { uid: string; kind: "channel" | "dm" | "group"; name: string | null; isPrivate: boolean; people: WorkUser[] } };
export interface ChatSearchResult {
  items: ChatSearchHit[];
  channels: { uid: string; kind: string; name: string | null; isPrivate: boolean; joined: boolean; memberCount: number }[];
  hasMore: boolean; nextCursor: string | null;
}
export interface ChatScheduled {
  id: number; parentId: number | null; content: string; mentionIds: number[]; files: ChatFile[]; sendAt: string;
  status: "pending" | "sending" | "sent" | "failed"; error: string | null; messageId: number | null; sentAt: string | null; createdAt: string;
  channel: { uid: string; kind: "channel" | "dm" | "group"; name: string | null; isPrivate: boolean; people: WorkUser[] };
}
export interface ChannelFileItem extends ChatFile { kind: "images" | "docs" | "media" | "other"; messageId: number; parentId: number | null; createdAt: string; user: WorkUser }
export type ChannelViewKind = "list" | "board" | "doc";
export interface ChannelViewTab {
  id: number; kind: ChannelViewKind; name: string; position: number;
  list: { id: number; uid: string; name: string } | null; locked: boolean;
  content?: string; updatedAt: string; updatedBy: WorkUser | null;
}
export interface ChatChannelRow {
  id: number; uid: string; kind: "channel" | "dm" | "group"; name: string | null; description: string | null; topic: string | null; isPrivate: boolean;
  locationType: string | null; locationId: number | null; lastMessageAt: string | null; joined: boolean; muted: boolean; starred: boolean;
  notify: ChatNotify; permission: ChatPermission | null; sectionId: number | null;
  unread: number; mentions: number; memberCount: number; people: WorkUser[];
}
export interface ChatChannelDetail {
  id: number; uid: string; kind: "channel" | "dm" | "group"; name: string | null; description: string | null; topic: string | null; isPrivate: boolean;
  locationType: string | null; locationId: number | null; createdAt: string; joined: boolean; muted: boolean; starred: boolean; myRole: string | null;
  canManage: boolean; canPost: boolean; notify: ChatNotify; myPermission: ChatPermission | null;
  members: { role: string; permission: ChatPermission; workRole: WorkRole | null; joinedAt: string; user: WorkUser }[]; pinned: ChatMessage[];
}

export const workApi = {
  chatSidebar: (ws: string) => get<ChatChannelRow[]>(`/work/workspaces/${ws}/chat`),
  createChannel: (ws: string, body: { name: string; description?: string; isPrivate?: boolean; memberIds?: number[]; locationType?: string; locationId?: number }) => post<{ uid: string; name: string }>(`/work/workspaces/${ws}/chat/channels`, body),
  openDm: (ws: string, userIds: number[]) => post<{ uid: string; created: boolean }>(`/work/workspaces/${ws}/chat/dm`, { userIds }),
  chatDrafts: (ws: string) => get<{ content: string; parentId: number; updatedAt: string; channel: { uid: string; name: string | null; kind: string } }[]>(`/work/workspaces/${ws}/chat/drafts`),
  chatSent: (ws: string) => get<ChatMessage[]>(`/work/workspaces/${ws}/chat/sent`),
  chatSaved: (ws: string) => get<ChatMessage[]>(`/work/workspaces/${ws}/chat/saved`),
  chatActivity: (ws: string) => get<ChatMessage[]>(`/work/workspaces/${ws}/chat/activity`),
  chatPosts: (ws: string, type?: string) => get<ChatMessage[]>(`/work/workspaces/${ws}/chat/posts${type ? `?type=${type}` : ""}`),
  chatUpload: (ws: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return post<ChatFile[]>(`/work/workspaces/${ws}/chat/files`, fd);
  },
  channel: (uid: string) => get<ChatChannelDetail>(`/work/chat/channels/${uid}`),
  updateChannel: (uid: string, body: { name?: string; description?: string | null; topic?: string | null; isPrivate?: boolean }) => patch(`/work/chat/channels/${uid}`, body),
  archiveChannel: (uid: string) => del(`/work/chat/channels/${uid}`),
  joinChannel: (uid: string) => post(`/work/chat/channels/${uid}/join`),
  leaveChannel: (uid: string) => post(`/work/chat/channels/${uid}/leave`),
  addChannelMembers: (uid: string, userIds: number[]) => post(`/work/chat/channels/${uid}/members`, { userIds }),
  removeChannelMember: (uid: string, userId: number) => del(`/work/chat/channels/${uid}/members/${userId}`),
  channelPrefs: (uid: string, body: { muted?: boolean; starred?: boolean; notify?: ChatNotify }) => put(`/work/chat/channels/${uid}/prefs`, body),
  unreadChannel: (uid: string) => post(`/work/chat/channels/${uid}/unread`),
  closeDm: (uid: string) => post(`/work/chat/channels/${uid}/close`),
  setChannelPermission: (uid: string, userId: number, permission: ChatPermission) => put(`/work/chat/channels/${uid}/permissions/${userId}`, { permission }),
  setAllChannelPermissions: (uid: string, permission: ChatPermission) => put(`/work/chat/channels/${uid}/permissions`, { permission }),
  chatReadAll: (ws: string, section: "channels" | "dms" | number) => post(`/work/workspaces/${ws}/chat/read-all?section=${section}`),
  chatSections: (ws: string) => get<ChatSection[]>(`/work/workspaces/${ws}/chat/sections`),
  createChatSection: (ws: string, name: string) => post<ChatSection>(`/work/workspaces/${ws}/chat/sections`, { name }),
  renameChatSection: (id: number, name: string) => patch<ChatSection>(`/work/chat/sections/${id}`, { name }),
  deleteChatSection: (id: number) => del(`/work/chat/sections/${id}`),
  reorderChatSections: (ws: string, ids: number[]) => put<ChatSection[]>(`/work/workspaces/${ws}/chat/sections/order`, { ids }),
  moveChannelToSection: (uid: string, sectionId: number | null) => put(`/work/chat/channels/${uid}/section`, { sectionId }),
  chatSearch: (ws: string, o: { q?: string; from?: string; in?: string; after?: string; has?: string; mentions?: boolean; kind?: string; cursor?: string }) =>
    get<ChatSearchResult>(`/work/workspaces/${ws}/chat/search?${new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== false).map(([k, v]) => [k, String(v)]))}`),
  scheduleChat: (uid: string, body: { content: string; parentId?: number; mentionIds?: number[]; files?: ChatFile[]; sendAt: string }) => post<ChatScheduled>(`/work/chat/channels/${uid}/scheduled`, body),
  chatScheduled: (ws: string, channelUid?: string) => get<ChatScheduled[]>(`/work/workspaces/${ws}/chat/scheduled${channelUid ? `?channel=${channelUid}` : ""}`),
  updateScheduledChat: (id: number, body: { content?: string; sendAt?: string }) => patch<ChatScheduled>(`/work/chat/scheduled/${id}`, body),
  deleteScheduledChat: (id: number) => del(`/work/chat/scheduled/${id}`),
  sendScheduledChat: (id: number) => post(`/work/chat/scheduled/${id}/send`),
  channelFiles: (uid: string, o: { type?: string; q?: string; cursor?: string }) =>
    get<{ items: ChannelFileItem[]; hasMore: boolean; nextCursor: string | null }>(`/work/chat/channels/${uid}/files?${new URLSearchParams(Object.entries(o).filter(([, v]) => !!v) as [string, string][])}`),
  channelViews: (uid: string) => get<ChannelViewTab[]>(`/work/chat/channels/${uid}/views`),
  addChannelView: (uid: string, body: { kind: ChannelViewKind; name?: string; listId?: number }) => post<ChannelViewTab>(`/work/chat/channels/${uid}/views`, body),
  updateChannelView: (id: number, body: { name?: string; content?: string }) => patch<ChannelViewTab>(`/work/chat/views/${id}`, body),
  deleteChannelView: (id: number) => del(`/work/chat/views/${id}`),
  reorderChannelViews: (uid: string, ids: number[]) => put<ChannelViewTab[]>(`/work/chat/channels/${uid}/views/order`, { ids }),
  readChannel: (uid: string) => post(`/work/chat/channels/${uid}/read`),
  chatTyping: (uid: string) => post(`/work/chat/channels/${uid}/typing`),
  chatDraft: (uid: string, content: string, parentId?: number) => put(`/work/chat/channels/${uid}/draft`, { content, ...(parentId ? { parentId } : {}) }),
  chatMessages: (uid: string, opts: { before?: string; q?: string; posts?: boolean } = {}) =>
    get<{ items: ChatMessage[]; hasMore: boolean }>(`/work/chat/channels/${uid}/messages?${opts.before ? `before=${encodeURIComponent(opts.before)}&` : ""}${opts.q ? `q=${encodeURIComponent(opts.q)}&` : ""}${opts.posts ? "posts=true" : ""}`),
  sendChat: (uid: string, body: { content?: string; parentId?: number; kind?: "message" | "post"; title?: string; postType?: string; mentionIds?: number[]; files?: ChatFile[]; alsoInChannel?: boolean }) => post<ChatMessage>(`/work/chat/channels/${uid}/messages`, body),
  chatThread: (id: number) => get<{ parent: ChatMessage; replies: ChatMessage[]; channelUid: string }>(`/work/chat/messages/${id}/thread`),
  editChat: (id: number, content: string, title?: string) => patch<ChatMessage>(`/work/chat/messages/${id}`, { content, ...(title ? { title } : {}) }),
  deleteChat: (id: number) => del(`/work/chat/messages/${id}`),
  reactChat: (id: number, emoji: string) => post<ChatMessage>(`/work/chat/messages/${id}/reactions`, { emoji }),
  pinChat: (id: number, on: boolean) => put<ChatMessage>(`/work/chat/messages/${id}/pin`, { on }),
  saveChat: (id: number, on: boolean) => put(`/work/chat/messages/${id}/save`, { on }),
  chatToTask: (id: number, listId: number, name?: string) => post<{ uid: string; name: string; listUid: string }>(`/work/chat/messages/${id}/task`, { listId, ...(name ? { name } : {}) }),
  chatAssign: (id: number, assigneeId: number | null) => post<ChatMessage>(`/work/chat/messages/${id}/assign`, { assigneeId }),
  chatResolve: (id: number, resolved: boolean) => post<ChatMessage>(`/work/chat/messages/${id}/${resolved ? "resolve" : "reopen"}`),
  chatRemind: (id: number, remindAt: string) => post(`/work/chat/messages/${id}/remind`, { remindAt }),
  chatForward: (id: number, channelUid: string, note?: string) => post<ChatMessage>(`/work/chat/messages/${id}/forward`, { channelUid, ...(note ? { note } : {}) }),
  chatAssigned: (ws: string, resolved = false) => get<ChatMessage[]>(`/work/workspaces/${ws}/chat/assigned${resolved ? "?resolved=true" : ""}`),
  automations: (spaceId: number, at: { folderId?: number | null; listId?: number | null } = {}) =>
    get<WorkAutomation[]>(`/work/spaces/${spaceId}/automations?${at.folderId ? `folderId=${at.folderId}&` : ""}${at.listId ? `listId=${at.listId}` : ""}`),
  createAutomation: (spaceId: number, body: { name?: string; folderId?: number; listId?: number; trigger: AutomationTrigger; conditions?: AutomationCondition[]; actions: AutomationAction[] }) =>
    post<WorkAutomation>(`/work/spaces/${spaceId}/automations`, body),
  updateAutomation: (id: number, body: Partial<{ name: string; enabled: boolean; trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[] }>) => patch<WorkAutomation>(`/work/automations/${id}`, body),
  deleteAutomation: (id: number) => del(`/work/automations/${id}`),
  automationRuns: (id: number) => get<WorkAutomationRun[]>(`/work/automations/${id}/runs`),
  createWorkspace: (body: { name: string; color?: string; useCase?: string; teamSize?: string; inviteEmails?: string[] }) =>
    post<{ id: number; uid: string; name: string; color: string; invited: { email: string; status: string }[] }>(`/work/workspaces`, body),
  updateWorkspace: (ws: string | number, body: { name?: string; color?: string }) => patch<{ uid: string; name: string; color: string }>(`/work/workspaces/${ws}`, body),
  deleteWorkspace: (ws: string | number, confirmName: string) => del(`/work/workspaces/${ws}`, { data: { confirmName } }),
  directory: (ws: string | number) => get<WorkDirectory>(`/work/workspaces/${ws}/directory`),
  profile: (ws: string | number, userId: number) => get<WorkProfile>(`/work/workspaces/${ws}/profiles/${userId}`),
  profileTasks: (ws: string | number, userId: number) => get<ProfileTasks>(`/work/workspaces/${ws}/profiles/${userId}/tasks`),
  profileComments: (ws: string | number, userId: number, resolved = false) => get<ProfileComment[]>(`/work/workspaces/${ws}/profiles/${userId}/comments${resolved ? "?resolved=true" : ""}`),
  profileActivity: (ws: string | number, userId: number) => get<ProfileActivity[]>(`/work/workspaces/${ws}/profiles/${userId}/activity`),
  updateProfile: (ws: string | number, userId: number, body: { title?: string | null; timezone?: string | null; managerId?: number | null }) => patch<WorkProfile>(`/work/workspaces/${ws}/profiles/${userId}`, body),
  addPriority: (ws: string | number, userId: number, taskId: number) => post(`/work/workspaces/${ws}/profiles/${userId}/priorities`, { taskId }),
  removePriority: (ws: string | number, userId: number, taskId: number) => del(`/work/workspaces/${ws}/profiles/${userId}/priorities/${taskId}`),
  createTeam: (ws: string | number, body: { name: string; color?: string; memberIds?: number[] }) => post<{ id: number }>(`/work/workspaces/${ws}/teams`, body),
  updateTeam: (id: number, body: { name?: string; color?: string; memberIds?: number[] }) => patch(`/work/teams/${id}`, body),
  deleteTeam: (id: number) => del(`/work/teams/${id}`),
  analytics: (ws: string | number, day?: string) => get<WorkAnalytics>(`/work/workspaces/${ws}/analytics${day ? `?day=${day}` : ""}`),
  stats: (kind: StatsKind, uid: string) => get<WorkStats>(`/work/stats/${kind}/${uid}`),
  reminders: (workspace: string | number, done = false) => get<WorkReminder[]>(`/work/workspaces/${workspace}/reminders${done ? "?done=true" : ""}`),
  createReminder: (workspace: string | number, body: { title: string; description?: string; remindAt: string; assigneeId?: number; taskUid?: string }) =>
    post<WorkReminder>(`/work/workspaces/${workspace}/reminders`, body),
  updateReminder: (id: number, body: { done?: boolean; remindAt?: string; title?: string }) => patch<WorkReminder>(`/work/reminders/${id}`, body),
  deleteReminder: (id: number) => del(`/work/reminders/${id}`),
  fields: (spaceId: number) => get<WorkField[]>(`/work/spaces/${spaceId}/fields`),
  createField: (spaceId: number, body: { name: string; type: FieldType; config?: Record<string, unknown> }) => post<WorkField>(`/work/spaces/${spaceId}/fields`, body),
  updateField: (id: number, body: { name?: string; config?: Record<string, unknown>; order?: number }) => patch<WorkField>(`/work/fields/${id}`, body),
  deleteField: (id: number) => del(`/work/fields/${id}`),
  listFieldValues: (listId: number) => get<FieldValues>(`/work/lists/${listId}/field-values`),
  taskFieldValues: (taskId: number) => get<Record<number, unknown>>(`/work/tasks/${taskId}/field-values`),
  setFieldValue: (taskId: number, fieldId: number, value: unknown) => put<{ fieldId: number; value: unknown }>(`/work/tasks/${taskId}/fields/${fieldId}`, { value }),
  spaceOverview: (uid: string) => get<WorkOverview>(`/work/spaces/${uid}/overview`),
  folderOverview: (uid: string) => get<WorkOverview>(`/work/folders/${uid}/overview`),
  assignComment: (commentId: number, assigneeId: number | null) => post<{ id: number; assigneeId: number | null }>(`/work/comments/${commentId}/assign`, { assigneeId }),
  commentUnread: (commentId: number) => post<{ ok: true }>(`/work/comments/${commentId}/unread`),
  followComment: (commentId: number, on: boolean) => put<{ commentId: number; following: boolean }>(`/work/comments/${commentId}/follow`, { on }),
  taskMine: (taskId: number) => get<WorkTaskMine>(`/work/tasks/${taskId}/me`),
  watchTask: (taskId: number, following: boolean) => put<WorkTaskMine>(`/work/tasks/${taskId}/watch`, { following }),
  favoriteTask: (taskId: number, on: boolean) => put<WorkTaskMine>(`/work/tasks/${taskId}/favorite`, { on }),
  favorites: (workspace: string | number) => get<{ id: number; uid: string; name: string; list: { uid: string; name: string } }[]>(`/work/workspaces/${workspace}/favorites`),
  duplicateTask: (taskId: number) => post<WorkTask>(`/work/tasks/${taskId}/duplicate`),
  addTaskToList: (taskId: number, listId: number) => post<WorkOtherList[]>(`/work/tasks/${taskId}/lists`, { listId }),
  removeTaskFromList: (taskId: number, listId: number) => del(`/work/tasks/${taskId}/lists/${listId}`),
  setTaskHome: (taskId: number, listId: number) => post<WorkOtherList[]>(`/work/tasks/${taskId}/lists/${listId}/home`),
  react: (commentId: number, emoji: string) => post<WorkReaction[]>(`/work/comments/${commentId}/reactions`, { emoji }),
  notificationSettings: () => get<NotificationPref[]>(`/work/notification-settings`),
  setNotificationSetting: (p: NotificationPref) => put<NotificationPref[]>(`/work/notification-settings`, p),
  workInbox: (view: "active" | "later" | "cleared" | "all") =>
    get<{ items: any[]; counts: { later: number; cleared: number } }>(`/work/inbox?view=${view}`),
  workInboxBulk: (ids: string[], action: "clear" | "unclear" | "snooze" | "unsnooze" | "read" | "unread", until?: string) =>
    patch<{ count: number }>(`/work/inbox`, { ids, action, ...(until ? { until } : {}) }),
  myWorkspaces: () => get<WorkWorkspaceInfo[]>(`/work/my-workspaces`),
  people: (workspace: string | number) => get<WorkPeople>(`/work/workspaces/${workspace}/people`),
  invite: (workspace: string | number, emails: string[], role: Exclude<WorkRole, "OWNER">) =>
    post<{ results: InviteResult[] }>(`/work/workspaces/${workspace}/invites`, { emails, role }),
  changeRole: (workspace: string | number, userId: number, role: Exclude<WorkRole, "OWNER">) => patch(`/work/workspaces/${workspace}/people/${userId}`, { role }),
  removePerson: (workspace: string | number, userId: number) => del(`/work/workspaces/${workspace}/people/${userId}`),
  revokeInvite: (id: number) => del(`/work/invites/${id}`),
  spaceMembers: (spaceId: number) => get<{ userIds: number[] }>(`/work/spaces/${spaceId}/members`),

  tree: (workspace: string | number) => get<WorkTree>(`/work/workspaces/${workspace}/tree`),
  allTasks: (workspace: string | number) => get<MyWorkTask[]>(`/work/workspaces/${workspace}/all-tasks`),
  myTasks: (workspace: string | number) => get<MyWorkTask[]>(`/work/workspaces/${workspace}/my-tasks`),

  spaceTemplates: () => get<SpaceTemplate[]>(`/work/space-templates`),
  createSpace: (workspace: string | number, body: { name: string; color?: string; icon?: string; isPrivate?: boolean; description?: string; defaultPermission?: SpacePermission; memberIds?: number[]; templateId?: string }) =>
    post<WorkSpaceNode>(`/work/workspaces/${workspace}/spaces`, body),
  updateSpace: (id: number, body: Partial<{ name: string; color: string; isPrivate: boolean; order: number }>) =>
    patch(`/work/spaces/${id}`, body),
  archiveSpace: (id: number) => del(`/work/spaces/${id}`),
  setSpaceMembers: (id: number, userIds: number[]) => put(`/work/spaces/${id}/members`, { userIds }),

  createStatus: (spaceId: number, body: { name: string; color: string; category?: StatusCategory }) =>
    post<WorkStatus>(`/work/spaces/${spaceId}/statuses`, body),
  updateStatus: (id: number, body: Partial<{ name: string; color: string; category: StatusCategory; order: number }>) =>
    patch<WorkStatus>(`/work/statuses/${id}`, body),
  deleteStatus: (id: number) => del(`/work/statuses/${id}`),

  createFolder: (spaceId: number, name: string) => post<WorkFolderNode>(`/work/spaces/${spaceId}/folders`, { name }),
  updateFolder: (id: number, body: Partial<{ name: string; order: number }>) => patch(`/work/folders/${id}`, body),
  archiveFolder: (id: number) => del(`/work/folders/${id}`),

  createList: (spaceId: number, body: { name: string; folderId?: number; color?: string }) =>
    post<WorkListNode>(`/work/spaces/${spaceId}/lists`, body),
  getList: (uid: string) => get<WorkListDetail>(`/work/lists/${uid}`),
  updateList: (id: number, body: Partial<{ name: string; color: string | null; description: string | null; folderId: number | null; order: number }>) =>
    patch(`/work/lists/${id}`, body),
  archiveList: (id: number) => del(`/work/lists/${id}`),

  listTasks: (listId: number) => get<WorkTask[]>(`/work/lists/${listId}/tasks`),
  createTask: (listId: number, body: TaskInput & { name: string }) => post<WorkTask>(`/work/lists/${listId}/tasks`, body),
  getTask: (uid: string) => get<WorkTaskDetail>(`/work/tasks/${uid}`),
  updateTask: (id: number, body: TaskInput) => patch<WorkTask>(`/work/tasks/${id}`, body),
  archiveTask: (id: number) => del(`/work/tasks/${id}`),

  comments: (taskId: number) => get<WorkComment[]>(`/work/tasks/${taskId}/comments`),
  addComment: (taskId: number, content: string, opts?: { parentId?: number; assigneeId?: number; attachmentIds?: number[]; mentionIds?: number[] }) =>
    post<WorkComment>(`/work/tasks/${taskId}/comments`, { content, ...(opts?.parentId ? { parentId: opts.parentId } : {}), ...(opts?.assigneeId ? { assigneeId: opts.assigneeId } : {}), ...(opts?.attachmentIds?.length ? { attachmentIds: opts.attachmentIds } : {}), ...(opts?.mentionIds?.length ? { mentionIds: opts.mentionIds } : {}) }),
  resolveComment: (id: number) => post<WorkComment>(`/work/comments/${id}/resolve`),
  reopenComment: (id: number) => post<WorkComment>(`/work/comments/${id}/reopen`),
  assignedComments: (workspace: string | number, mode: "to-me" | "by-me", resolved = false) =>
    get<any[]>(`/work/workspaces/${workspace}/assigned-comments?mode=${mode}&resolved=${resolved}`),
  activity: (taskId: number) => get<WorkActivity[]>(`/work/tasks/${taskId}/activity`),

  attachments: (taskId: number) => get<WorkAttachment[]>(`/work/tasks/${taskId}/attachments`),
  uploadAttachments: (taskId: number, files: File[], source: WorkAttachment["source"] = "task") => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return post<WorkAttachment[]>(`/work/tasks/${taskId}/attachments?source=${source}`, fd);
  },
  deleteAttachment: (id: number) => del(`/work/attachments/${id}`),
  webLinks: (taskId: number) => get<WorkWebLink[]>(`/work/tasks/${taskId}/web-links`),
  addWebLink: (taskId: number, url: string, title?: string) => post<WorkWebLink>(`/work/tasks/${taskId}/web-links`, { url, ...(title ? { title } : {}) }),
  deleteWebLink: (id: number) => del(`/work/web-links/${id}`),


  tags: (spaceId: number) => get<WorkTag[]>(`/work/spaces/${spaceId}/tags`),
  createTag: (spaceId: number, name: string, color: string) => post<WorkTag>(`/work/spaces/${spaceId}/tags`, { name, color }),
  deleteTag: (id: number) => del(`/work/tags/${id}`),

  createChecklist: (taskId: number, name: string) => post<WorkChecklist>(`/work/tasks/${taskId}/checklists`, { name }),
  updateChecklist: (id: number, body: Partial<{ name: string; order: number }>) => patch(`/work/checklists/${id}`, body),
  deleteChecklist: (id: number) => del(`/work/checklists/${id}`),
  addChecklistItem: (checklistId: number, name: string, assigneeId?: number) =>
    post<WorkChecklistItem>(`/work/checklists/${checklistId}/items`, { name, ...(assigneeId ? { assigneeId } : {}) }),
  updateChecklistItem: (id: number, body: Partial<{ name: string; done: boolean; assigneeId: number | null; order: number }>) =>
    patch<WorkChecklistItem>(`/work/checklist-items/${id}`, body),
  deleteChecklistItem: (id: number) => del(`/work/checklist-items/${id}`),

  addLink: (taskId: number, otherTaskId: number, type: "WAITING_ON" | "BLOCKING" | "LINKED") =>
    post(`/work/tasks/${taskId}/links`, { taskId: otherTaskId, type }),
  removeLink: (linkId: number) => del(`/work/links/${linkId}`),

  time: (taskId: number) => get<{ totalSeconds: number; entries: WorkTimeEntry[] }>(`/work/tasks/${taskId}/time`),
  startTimer: (taskId: number) => post(`/work/tasks/${taskId}/time/start`),
  stopTimer: () => post(`/work/time/stop`),
  runningTimer: () => get<{ id: number; startedAt: string; task: { id: number; uid: string; name: string; list: { uid: string; space: { workspaceId: number; workspace: { uid: string } } } } } | null>(`/work/time/running`),
  addTime: (taskId: number, body: { startedAt: string; duration: number; note?: string }) => post(`/work/tasks/${taskId}/time`, body),
  deleteTime: (id: number) => del(`/work/time/${id}`),
  editComment: (id: number, content: string) => patch<WorkComment>(`/work/comments/${id}`, { content }),
  deleteComment: (id: number) => del(`/work/comments/${id}`),
};

/* ─── shared helpers ───────────────────────────────────────────────────── */

export const workKeys = {
  tree: (ws: string) => ["work", "tree", ws] as const,
  list: (uid: string) => ["work", "list", uid] as const,
  tasks: (listId: number) => ["work", "tasks", listId] as const,
  task: (uid: string) => ["work", "task", uid] as const,
  comments: (taskId: number) => ["work", "comments", taskId] as const,
  my: (ws: string) => ["work", "my", ws] as const,
};

export const PRIORITY_META: Record<WorkPriority, { label: string; color: string; rank: number }> = {
  URGENT: { label: "Urgent", color: "#DC2626", rank: 0 },
  HIGH: { label: "High", color: "#D97706", rank: 1 },
  NORMAL: { label: "Normal", color: "#2563EB", rank: 2 },
  LOW: { label: "Low", color: "#9CA3AF", rank: 3 },
};

export const userName = (u: Pick<WorkUser, "firstName" | "lastName">) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
export const initials = (u: Pick<WorkUser, "firstName" | "lastName">) =>
  `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";

/** Calendar day (local) of an ISO date. */
export function dayOf(iso: string) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isTaskOverdue(t: Pick<WorkTask, "dueDate" | "completedAt">) {
  if (!t.dueDate || t.completedAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dayOf(t.dueDate) < today;
}

/** 5400 -> "1h 30m", 45 -> "45s" */
export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return `${m}m`;
  return `${Math.max(0, Math.round(totalSeconds))}s`;
}

/** minutes -> "1h 30m" */
export const formatMinutes = (min: number) => formatDuration(min * 60);

/** "1h 30m" | "90m" | "1.5h" | "90" (minutes) -> minutes, or null if unparseable */
export function parseEstimate(input: string): number | null {
  const v = input.trim().toLowerCase();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  let total = 0;
  let matched = false;
  for (const [, n, unit] of v.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)/g)) {
    matched = true;
    total += unit!.startsWith("h") ? Number(n) * 60 : Number(n);
  }
  return matched ? Math.round(total) : null;
}
