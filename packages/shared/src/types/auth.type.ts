import { UserRole } from '../enums/user-roles.enum.js';
import { USerStatus } from '../enums/user-status.enum.js';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: USerStatus;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
}