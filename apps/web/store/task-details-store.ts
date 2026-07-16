"use client";

import { create } from "zustand";

interface TaskDetailsContext {
  taskId?: number;
  boardId?: number;
  groupId?: number;
}

interface TaskDetailsStore {
  isOpen: boolean;
  context: TaskDetailsContext;

  open: (context: TaskDetailsContext) => void;
  close: () => void;

  setTask: (taskId: number) => void;
  setBoard: (boardId: number) => void;
  setGroup: (groupId: number) => void;
}

export const useTaskDetailsStore = create<TaskDetailsStore>((set) => ({
  isOpen: false,
  context: {},

  open: (context) =>
    set({
      isOpen: true,
      context,
    }),

  close: () =>
    set({
      isOpen: false,
      context: {},
    }),

  setTask: (taskId) =>
    set((state) => ({
      context: {
        ...state.context,
        taskId,
      },
    })),

  setBoard: (boardId) =>
    set((state) => ({
      context: {
        ...state.context,
        boardId,
      },
    })),

  setGroup: (groupId) =>
    set((state) => ({
      context: {
        ...state.context,
        groupId,
      },
    })),
}));