"use client";

import { create } from "zustand";

interface InviteModalStore {
  isOpen: boolean;

  // Active context
  workspaceId?: number;
  boardId?: number;

  setWorkspace: (id?: number) => void;
  setBoard: (id?: number) => void;

  // Modal controls
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
    }),
}));
