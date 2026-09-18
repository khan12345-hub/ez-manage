import {
  Bell,
  CalendarDays,
  CirclePlus,
  FileText,
  FolderKanban,
  Mail,
  MessageCircle,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type AutomationActionType =
  | "move"
  | "notify"
  | "change-status"
  | "create-subitem"
  | "set-date"
  | "send-email"
  | "assign"
  | "send-whatsapp";

export type AutomationAction = {
  value: AutomationActionType;
  label: string;
  icon: LucideIcon;
  category: "Most used" | "Featured";
};

export const AUTOMATION_ACTIONS = [
  {
    value: "move",
    label: "move item to group",
    icon: FolderKanban,
    category: "Most used",
  },
  {
    value: "notify",
    label: "notify",
    icon: Bell,
    category: "Most used",
  },
  {
    value: "change-status",
    label: "change status",
    icon: FileText,
    category: "Most used",
  },
  {
    value: "assign",
    label: "assign someone",
    icon: UserRound,
    category: "Most used",
  },
  {
    value: "create-subitem",
    label: "create subitem",
    icon: CirclePlus,
    category: "Featured",
  },
  {
    value: "set-date",
    label: "set date",
    icon: CalendarDays,
    category: "Featured",
  },
  {
    value: "send-email",
    label: "send email",
    icon: Mail,
    category: "Featured",
  },
  {
    value: "send-whatsapp",
    label: "send WhatsApp message",
    icon: MessageCircle,
    category: "Featured",
  },
] as const satisfies readonly AutomationAction[];