import { SystemRole } from 'generated/prisma/enums';

export type SessionUser = {
  id: number;
  systemRole: SystemRole;
};