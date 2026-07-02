import { UserRole } from '@shared/*';

export type SessionUser = {
  id: number;
  role: UserRole;
};