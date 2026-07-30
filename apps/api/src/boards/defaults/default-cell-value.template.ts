
import { BoardColumnType, BoardMemberRole } from 'generated/prisma/enums';

interface DefaultCellUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface DefaultStatusOption {
  id: number;
  label: string;
  color: string;
}

export function getDefaultCellValue(
  type: BoardColumnType,
  task: any,
  user: DefaultCellUser,
  statusOptions: DefaultStatusOption[],
  role: BoardMemberRole = BoardMemberRole.OWNER,
) {
  switch (type) {
    case BoardColumnType.TEXT:
      return {
        text: task.title,
      };

    case BoardColumnType.PERSON:
      return {
        users: [
          {
            id: user.id,
            role,
            email: user.email,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
            firstName: user.firstName,
          },
        ],
      };

    case BoardColumnType.STATUS: {
      const statusOption = statusOptions.find(
        (status) => status.label === task.status,
      );

      if (!statusOption) {
        return {};
      }

      return {
        label: statusOption.label,
        color: statusOption.color,
      };
    }

    case BoardColumnType.DATE:
      return task.date
        ? {
            date: task.date,
          }
        : {};

    default:
      return {};
  }
}

