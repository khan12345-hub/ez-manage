import { create } from "zustand";

export interface Group {
  id: number | string;
  name: string;
  color: string;
  isNew?: boolean;
  isEditing?: boolean;
}

interface GroupStore {
  groups: Group[];
  setGroups: (groups: Group[]) => void;
  addNewGroup: () => void;
  updateGroup: (id: number, data: Partial<Group>) => void;
  removeGroup: (id: number) => void;
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
          color: "#3B82F6",
          isNew: true,
        },
      ],
    })),
  updateGroup: (id, data) =>
    set((prev) => ({
      groups: prev.groups.map((group) =>
        group.id === id ? { ...group, ...data } : group,
      ),
    })),
  removeGroup: (id) =>
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
    })),
}));
