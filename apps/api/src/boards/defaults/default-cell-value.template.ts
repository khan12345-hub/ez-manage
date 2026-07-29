import { User } from '../../../generated/prisma/client';
import { BoardColumnType } from 'generated/prisma/enums';

export function getDefaultCellValue(
  type: BoardColumnType,
  task: any,
  user: Pick<User, 'id' | 'firstName' | 'lastName'>,
  statusOptionByLabel: Map<string, number>,
) {
  switch (type) {
    case BoardColumnType.TEXT:
      return {
        text: task.title,
      };

    case BoardColumnType.PERSON:
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      };

    case BoardColumnType.STATUS:
      return String(statusOptionByLabel.get(task.status) ?? '');

    case BoardColumnType.DATE:
      return task.date;

    default:
      return {};
  }
}
