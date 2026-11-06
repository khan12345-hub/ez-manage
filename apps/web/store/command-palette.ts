"use client";

import { create } from "zustand";

/**
 * Shared open state for the ⌘K command palette and the task search modal,
 * so the top-bar search button, the keyboard shortcut and palette items all
 * drive the same dialogs.
 */
interface CommandPaletteStore {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  taskSearchOpen: boolean;
  setTaskSearchOpen: (open: boolean) => void;
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  taskSearchOpen: false,
  setTaskSearchOpen: (taskSearchOpen) => set({ taskSearchOpen }),
}));
