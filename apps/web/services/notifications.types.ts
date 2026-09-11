export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  COMMENT_CREATED = "COMMENT_CREATED",
  COMMENT_MENTION = "COMMENT_MENTION",
  COMMENT_REPLY = "COMMENT_REPLY",

  BOARD_MEMBER_ADDED = "BOARD_MEMBER_ADDED",
  WORKSPACE_MEMBER_ADDED = "WORKSPACE_MEMBER_ADDED",

  TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
  TASK_DUE_SOON = "TASK_DUE_SOON",
}

export enum NotificationEntityType {
  TASK = "TASK",
  COMMENT = "COMMENT",
  BOARD = "BOARD",
  WORKSPACE = "WORKSPACE",
  LEAVE_REQUEST = "LEAVE_REQUEST",
}

export interface Notification {
  id: string;
  recipientId: number;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: Notification[];

  meta: {
    page: number;

    limit: number;

    total: number;

    totalPages: number;
  };
}
export interface UnreadCountResponse {
count: number;
}
