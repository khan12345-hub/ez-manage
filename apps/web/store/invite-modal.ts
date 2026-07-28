"use client";

import { create } from "zustand";

interface InviteModalStore {
  isOpen: boolean;

  workspaceId?: number;
  boardId?: number;

  setWorkspace: (id?: number) => void;
  setBoard: (id?: number) => void;

  boardRole?: string;
  workspaceRole?: string;

  setBoardRole: (role: string) => void;
  setWorkspaceRole: (role: string) => void;

  open: () => void;
  close: () => void;

  clearContext: () => void;
}

export const useInviteModalStore = create<InviteModalStore>((set) => ({
  isOpen: false,

  workspaceId: undefined,
  boardId: undefined,

  setWorkspace: (id) =>
    set({
      workspaceId: id,
    }),

  setBoard: (id) =>
    set({
      boardId: id,
    }),

  setBoardRole: (role) =>
    set({
      boardRole: role,
    }),

  setWorkspaceRole: (role) =>
    set({
      workspaceRole: role,
    }),

  open: () =>
    set({
      isOpen: true,
    }),

  close: () =>
    set({
      isOpen: false,
    }),

  clearContext: () =>
    set({
      workspaceId: undefined,
      boardId: undefined,
      boardRole: undefined,
      workspaceRole: undefined,
    }),
}));