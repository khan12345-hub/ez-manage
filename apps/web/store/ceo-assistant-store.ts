"use client";

import { create } from "zustand";
import type { EmailDraft, EmployeeTaskGroup } from "@/services/ceo-assistant.api";

interface Filters {
  inactivityDays: number;
  upcomingDays: number;
  categories: ("overdue" | "due_soon" | "inactive")[];
  tone: "professional" | "friendly" | "firm";
}

type CeoSection = "overview" | "team" | "management" | "meetings" | "email";

interface CeoAssistantStore {
  // Active dashboard section
  activeSection: CeoSection;
  setActiveSection: (section: CeoSection) => void;

  // Filters
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;

  // Employee selection (for email center)
  selectedEmployeeIds: Set<number>;
  toggleEmployee: (id: number) => void;
  selectAllEmployees: (ids: number[]) => void;
  clearSelectedEmployees: () => void;

  // Drafts (keyed by recipientId)
  drafts: Map<number, EmailDraft>;
  setDraft: (draft: EmailDraft) => void;
  setDrafts: (drafts: EmailDraft[]) => void;
  updateDraft: (recipientId: number, patch: Partial<Pick<EmailDraft, "subject" | "body">>) => void;
  clearDrafts: () => void;

  // Selected drafts for bulk send
  selectedDraftIds: Set<number>;
  toggleDraftSelection: (recipientId: number) => void;
  selectAllDrafts: () => void;
  clearDraftSelection: () => void;

  // Generation loading
  generatingIds: Set<number>;
  setGenerating: (ids: number[]) => void;
  clearGenerating: () => void;

  // Employee data (overview result)
  employees: EmployeeTaskGroup[];
  setEmployees: (employees: EmployeeTaskGroup[]) => void;
}

export const useCeoAssistantStore = create<CeoAssistantStore>((set, get) => ({
  activeSection: "overview",
  setActiveSection: (section) => set({ activeSection: section }),

  filters: {
    inactivityDays: 3,
    upcomingDays: 7,
    categories: ["overdue", "due_soon", "inactive"],
    tone: "professional",
  },

  setFilters: (patch) =>
    set((s) => ({ filters: { ...s.filters, ...patch } })),

  selectedEmployeeIds: new Set(),
  toggleEmployee: (id) =>
    set((s) => {
      const next = new Set(s.selectedEmployeeIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedEmployeeIds: next };
    }),
  selectAllEmployees: (ids) => set({ selectedEmployeeIds: new Set(ids) }),
  clearSelectedEmployees: () => set({ selectedEmployeeIds: new Set() }),

  drafts: new Map(),
  setDraft: (draft) =>
    set((s) => {
      const next = new Map(s.drafts);
      next.set(draft.recipientId, draft);
      return { drafts: next };
    }),
  setDrafts: (drafts) => {
    const map = new Map(drafts.map((d) => [d.recipientId, d]));
    set({ drafts: map, selectedDraftIds: new Set(drafts.map((d) => d.recipientId)) });
  },
  updateDraft: (recipientId, patch) =>
    set((s) => {
      const existing = s.drafts.get(recipientId);
      if (!existing) return s;
      const next = new Map(s.drafts);
      next.set(recipientId, { ...existing, ...patch });
      return { drafts: next };
    }),
  clearDrafts: () => set({ drafts: new Map(), selectedDraftIds: new Set() }),

  selectedDraftIds: new Set(),
  toggleDraftSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedDraftIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedDraftIds: next };
    }),
  selectAllDrafts: () => {
    const ids = [...get().drafts.keys()];
    set({ selectedDraftIds: new Set(ids) });
  },
  clearDraftSelection: () => set({ selectedDraftIds: new Set() }),

  generatingIds: new Set(),
  setGenerating: (ids) => set({ generatingIds: new Set(ids) }),
  clearGenerating: () => set({ generatingIds: new Set() }),

  employees: [],
  setEmployees: (employees) => set({ employees }),
}));
