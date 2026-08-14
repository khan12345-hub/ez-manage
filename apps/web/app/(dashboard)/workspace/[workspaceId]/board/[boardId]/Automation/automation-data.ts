import {
  Bell,
  CalendarDays,
  Copy,
  Grid2X2,
  Heart,
  Settings2,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";

export const automationCategories = [
  {
    label: "Explore",
    icon: Grid2X2,
  },
//   {
//     label: "AI-powered",
//     icon: Sparkles,
//     new: true,
//   },
//   {
//     label: "2-way sync",
//     icon: Copy,
//     new: true,
//   },
//   {
//     label: "Recommended",
//     icon: Heart,
//   },
//   {
//     label: "Productivity",
//     icon: Zap,
//   },
//   {
//     label: "Dates",
//     icon: CalendarDays,
//   },
//   {
//     label: "Communication",
//     icon: Bell,
//   },
//   {
//     label: "Sync",
//     icon: Copy,
//   },
//   {
//     label: "Connected & mirror columns",
//     icon: Grid2X2,
//   },
];

export const automationTemplates = [
  {
    id: "assign-creator",
    title: "When an item is created assign creator as person",
    icon: UserPlus,
  },
  {
    id: "status-notify",
    title: "When status changes to something notify someone",
    icon: Bell,
  },
  {
    id: "date-notify",
    title: "When date arrives notify someone",
    icon: CalendarDays,
  },
];

export const statusOptions = [
  "Working on it",
  "Done",
  "Stuck",
];