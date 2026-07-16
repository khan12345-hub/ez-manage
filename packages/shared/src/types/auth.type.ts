import { UserRole } from "../enums/user-roles.enum.js";
import { USerStatus } from "../enums/user-status.enum.js";

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: USerStatus;
  workspaces: number[];
  boards: number[];
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
}
