"use client";

import {
  Bell,
  LayoutTemplate,
  Lock,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const navigation = [
  {
    id: "general",
    label: "General",
    description: "System preferences",
    icon: Settings,
  },
  {
    id: "templates",
    label: "Board Templates",
    description: "Reusable board structures",
    icon: LayoutTemplate,
  },
  {
    id: "users",
    label: "Users & Permissions",
    description: "Manage access",
    icon: Users,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Email and alerts",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Security preferences",
    icon: Shield,
  },
] as const;

export function SettingsSidebar() {
  return (
    <aside className="w-64 shrink-0">
      <TabsList className="h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="group h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-left font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted group-data-[state=active]:bg-primary/10">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground group-data-[state=active]:text-primary">
                  {item.label}
                </p>

                <p className="truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <Separator className="my-6" />

      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />

          <span className="text-sm font-medium">
            Administrator settings
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          These settings affect the entire EzManage system and may
          impact all users.
        </p>
      </div>
    </aside>
  );
}