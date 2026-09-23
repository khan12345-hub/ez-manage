
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
}

export interface Workspace {
  id: number;
  name: string;
  members: number;
  boards: number;
  tasks: number;
}

export interface Board {
  id: number;
  name: string;
  workspace: string;
  groups: number;
  tasks: number;
}

export interface MediaFile {
  id: number;
  name: string;
  type: string;
  size: string;
  location: string;
}

export interface SystemStats {
  users: number;
  workspaces: number;
  boards: number;
  groups: number;
  tasks: number;
  completedTasks: number;
  mediaFiles: number;
  mediaSize: string;
}

