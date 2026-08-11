import { GROUP_COLORS } from "@/constants/colors";
import { create } from "zustand";

export interface Task {
  id: number;
  order: number;
  groupId: number;
  [key: string]: any;
}

export interface Group {
  id: number | string;
  name: string;
  color?: string | null;
  tasks: Task[];

  isNew?: boolean;
  isEditing?: boolean;
}

interface GroupStore {
  groups: Group[];

  setGroups: (groups: Group[]) => void;

  addNewGroup: () => void;

  updateGroup: (id: number | string, data: Partial<Group>) => void;

  removeGroup: (id: number | string) => void;

  moveTask: (activeId: number, overId: number) => void;
}

export const useGroupStore = create<GroupStore>((set) => ({
  groups: [],

  setGroups: (groups) => set({ groups }),

  addNewGroup: () =>
    set((state) => ({
      groups: [
        ...state.groups,
        {
          id: `temp-${Date.now()}`,
          name: "New Group",
          color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)],
          tasks: [],
          isNew: true,
        },
      ],
    })),

  updateGroup: (id, data) =>
    set((state) => ({
      groups: state.groups.map((group) =>
        group.id === id ? { ...group, ...data } : group,
      ),
    })),

  removeGroup: (id) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
    })),

  moveTask: (activeId, overId) =>
    set((state) => {
      const groups = structuredClone(state.groups);

      let sourceGroup: Group | undefined;
      let destinationGroup: Group | undefined;

      let sourceIndex = -1;
      let destinationIndex = -1;

      for (const group of groups) {
        const index = group.tasks.findIndex((t) => t.id === activeId);
        if (index !== -1) {
          sourceGroup = group;
          sourceIndex = index;
        }

        // hovering a task
        const overTaskIndex = group.tasks.findIndex((t) => t.id === overId);

        if (overTaskIndex !== -1) {
          destinationGroup = group;
          destinationIndex = overTaskIndex;
        }

        // hovering the group itself
        if (group.id === overId) {
          destinationGroup = group;
          destinationIndex = group.tasks.length;
        }
      }

      if (
        !sourceGroup ||
        !destinationGroup ||
        sourceIndex === -1 ||
        destinationIndex === -1
      ) {
        return state;
      }

      if (
        sourceGroup.id === destinationGroup.id &&
        sourceIndex === destinationIndex
      ) {
        return state;
      }

      const [task] = sourceGroup.tasks.splice(sourceIndex, 1);

      if (!task) {
        return state;
      }

      task.groupId = Number(destinationGroup.id);

      destinationGroup.tasks.splice(destinationIndex, 0, task);

      return {
        groups,
      };
    }),
}));
