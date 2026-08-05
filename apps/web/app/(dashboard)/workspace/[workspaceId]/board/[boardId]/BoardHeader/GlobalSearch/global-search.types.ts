export interface SearchTask {
  id: number;
  name: string;
  group: {
    id: number;
    name: string;
    board: {
      id: number;
      name: string;
      workspaceId: number;
    };
  };
}

export interface SearchBoard {
  id: number;
  name: string;
  workspaceId: number;
}

export interface SearchGroup {
  id: number;
  name: string;
  board: SearchBoard;
}

export interface SearchUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface SearchFile {
  id: number;
  fileName: string;
  url: string;
}

export interface SearchResponse {
  tasks: SearchTask[];
  boards: SearchBoard[];
  groups: SearchGroup[];
  users: SearchUser[];
  files: SearchFile[];
}