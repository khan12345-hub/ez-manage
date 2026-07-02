import { UserRole } from '@shared/enums/user-role.enum';

export type SessionUser = {
  id: number;
  role: UserRole;
};