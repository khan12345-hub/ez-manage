"use client";

import { TaskActivity } from "@/services/activity-logs";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  CircleDot,
  Clock3,
  File,
  Hash,
  MessageCircle,
  Pencil,
  Plus,
  Reply,
  Tag,
  Trash2,
  Type,
  UserRound,
  UsersRound,
} from "lucide-react";

interface TaskActivityItemProps {
  activity: TaskActivity;
}

type ColumnType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "STATUS"
  | "PERSON"
  | "CHECKBOX"
  | "DROPDOWN"
  | "LABEL";

interface StatusValue {
  label?: string;
  color?: string;
}

function getRelativeTime(date: string) {
  const now = Date.now();
  const created = new Date(date).getTime();

  const seconds = Math.floor(
    (now - created) / 1000,
  );

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(
    seconds / 60,
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(
    hours / 24,
  );

  return `${days}d`;
}

function getInitials(
  user: TaskActivity["user"],
) {
  return `${user.firstName[0] ?? ""}${
    user.lastName[0] ?? ""
  }`;
}

function getColumnIcon(
  columnType?: string,
) {
  const iconClass =
    "h-4 w-4 shrink-0";

  switch (
    columnType as ColumnType
  ) {
    case "TEXT":
      return (
        <Type className={iconClass} />
      );

    case "NUMBER":
      return (
        <Hash className={iconClass} />
      );

    case "DATE":
      return (
        <CalendarDays
          className={iconClass}
        />
      );

    case "STATUS":
      return (
        <CircleDot
          className={iconClass}
        />
      );

    case "PERSON":
      return (
        <UserRound
          className={iconClass}
        />
      );

    case "CHECKBOX":
      return (
        <CheckSquare
          className={iconClass}
        />
      );

    case "DROPDOWN":
    case "LABEL":
      return (
        <Tag className={iconClass} />
      );

    default:
      return (
        <Pencil
          className={iconClass}
        />
      );
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function renderPersonValue(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    !("users" in value)
  ) {
    return "Empty";
  }

  const users = (
    value as {
      users?: Array<{
        id: number;
        firstName: string;
        lastName: string;
      }>;
    }
  ).users;

  if (!users?.length) {
    return "Empty";
  }

  return users
    .map(
      (user) =>
        `${user.firstName} ${user.lastName}`,
    )
    .join(", ");
}

function renderValue(
  value: unknown,
  columnType?: string,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "Empty";
  }

  switch (
    columnType as ColumnType
  ) {
    case "CHECKBOX": {
      if (
        typeof value === "object" &&
        value !== null &&
        "checked" in value
      ) {
        const checkedValue = (
          value as {
            checked?: {
              checked?: boolean;
            };
          }
        ).checked?.checked;

        if (
          typeof checkedValue ===
          "boolean"
        ) {
          return checkedValue
            ? "Checked"
            : "Unchecked";
        }
      }

      return "Empty";
    }

    case "DATE": {
      if (
        typeof value === "object" &&
        value !== null &&
        "date" in value
      ) {
        const dateValue = (
          value as {
            date?: string;
          }
        ).date;

        return dateValue
          ? formatDate(dateValue)
          : "Empty";
      }

      return "Empty";
    }

    case "PERSON":
      return renderPersonValue(
        value,
      );

    case "STATUS":
    case "DROPDOWN":
    case "LABEL": {
      if (
        typeof value === "object" &&
        value !== null &&
        "label" in value
      ) {
        return String(
          (
            value as {
              label?: unknown;
            }
          ).label ?? "Empty",
        );
      }

      return "Empty";
    }

    case "TEXT": {
      if (
        typeof value === "object" &&
        value !== null &&
        "text" in value
      ) {
        return String(
          (
            value as {
              text?: unknown;
            }
          ).text ?? "Empty",
        );
      }

      return String(value);
    }

    case "NUMBER": {
      if (
        typeof value === "object" &&
        value !== null &&
        "number" in value
      ) {
        return String(
          (
            value as {
              number?: unknown;
            }
          ).number ?? "Empty",
        );
      }

      return String(value);
    }

    default:
      return String(value);
  }
}

function renderActivityValue(
  value: unknown,
  columnType?: string,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return (
      <span className="text-muted-foreground">
        Empty
      </span>
    );
  }

  if (
    columnType === "STATUS" &&
    typeof value === "object" &&
    value !== null
  ) {
    const status =
      value as StatusValue;

    if (status.label) {
      return (
        <span
          className="inline-flex max-w-[180px] items-center truncate  px-4 py-2 text-xs font-medium text-white"
          style={{
            backgroundColor:
              status.color ??
              "#6B7280",
          }}
        >
          {status.label}
        </span>
      );
    }
  }

  return (
    <span className="truncate">
      {renderValue(
        value,
        columnType,
      )}
    </span>
  );
}

function getActivityIcon(
  activity: TaskActivity,
) {
  const {
    action,
    entityType,
    metadata,
  } = activity;

  if (
    entityType === "TASK_CELL" &&
    metadata?.columnType
  ) {
    return getColumnIcon(
      metadata.columnType,
    );
  }

  if (
    action === "ASSIGNED" ||
    action === "UNASSIGNED"
  ) {
    return (
      <UsersRound className="h-4 w-4" />
    );
  }

  if (action === "MOVED") {
    return (
      <ArrowRight className="h-4 w-4" />
    );
  }

  if (
    action === "FILE_ADDED" ||
    action === "FILE_DELETED"
  ) {
    return (
      <File className="h-4 w-4" />
    );
  }

  if (
    action === "COMMENT_ADDED" ||
    action === "COMMENT_UPDATED" ||
    action === "COMMENT_DELETED"
  ) {
    return (
      <MessageCircle className="h-4 w-4" />
    );
  }

  if (action === "REPLY_ADDED") {
    return (
      <Reply className="h-4 w-4" />
    );
  }

  if (action === "CREATED") {
    return (
      <Plus className="h-4 w-4" />
    );
  }

  if (action === "DELETED") {
    return (
      <Trash2 className="h-4 w-4" />
    );
  }

  return (
    <Pencil className="h-4 w-4" />
  );
}

function getActionLabel(
  activity: TaskActivity,
) {
  const {
    action,
    entityType,
  } = activity;

  if (
    entityType === "TASK_CELL" &&
    action === "UPDATED"
  ) {
    return null;
  }

  switch (action) {
    case "ASSIGNED":
      return "Assigned";

    case "UNASSIGNED":
      return "Unassigned";

    case "CREATED":
      return "Created";

    case "DELETED":
      return "Deleted";

    case "MOVED":
      return "Moved";

    case "FILE_ADDED":
      return "Added file";

    case "FILE_DELETED":
      return "Deleted file";

    case "COMMENT_ADDED":
      return "Added comment";

    case "COMMENT_UPDATED":
      return "Updated comment";

    case "COMMENT_DELETED":
      return "Deleted comment";

    case "REPLY_ADDED":
      return "Added reply";

    case "UPDATED":
      return "Updated";

    default:
      return "Updated";
  }
}

export function TaskActivityItem({
  activity,
}: TaskActivityItemProps) {
  const {
    action,
    entityType,
    metadata,
    user,
    task,
  } = activity;

  const columnType =
    metadata?.columnType;

  const columnName =
    metadata?.columnName ??
    columnType ??
    "Field";

  const isCellUpdate =
    entityType === "TASK_CELL" &&
    action === "UPDATED";

  const actorName =
    `${user.firstName} ${user.lastName}`;

  return (
    <div className="flex min-h-[58px] justify-between items-center gap-3 border-b border-border px-8 py-3 text-sm">
      {/* Time */}
      <div className="flex w-12 shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />

        <span>
          {getRelativeTime(
            activity.createdAt,
          )}
        </span>
      </div>

      {/* Task Name */}
      

      {/* Actor Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium"
        title={actorName}
      >
        {user.avatarUrl ? (
          <img
            src={
              process.env
                .NEXT_PUBLIC_BACKEND_BASE_URL +
              user.avatarUrl
            }
            alt={actorName}
            className="h-full w-full object-cover"
          />
        ) : (
          getInitials(user)
        )}
      </div>
      <div className="min-w-0 max-w-[180px] shrink-0 truncate font-medium">
        {task?.name ??
          "Unknown task"}
      </div>

      {/* Activity */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {/* Column Icon + Name */}
        <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          {getActivityIcon(activity)}

          <span className="max-w-[120px] truncate">
            {entityType ===
            "TASK_CELL"
              ? columnName
              : entityType}
          </span>
        </div>

        {/* Old -> New */}
        {isCellUpdate ? (
          <>
            <div className="min-w-0 max-w-[180px] truncate text-muted-foreground">
              {renderActivityValue(
                metadata?.oldValue,
                columnType,
              )}
            </div>

            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />

            <div className="min-w-0 max-w-[220px] truncate font-medium">
              {renderActivityValue(
                metadata?.newValue,
                columnType,
              )}
            </div>
          </>
        ) : (
          <span className="truncate">
            {getActionLabel(
              activity,
            )}
          </span>
        )}
      </div>
    </div>
  );
}

