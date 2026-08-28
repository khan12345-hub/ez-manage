
"use client";

import {
  ChevronDown,
  HardDrive,
  LayoutDashboard,
  LayoutTemplate,
  Settings,
  Users,
  FolderKanban,
  BarChart3,
} from "lucide-react";

import {
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const navigation = [
  {
    id: "general",
    label: "General",
    description: "System management",
    icon: Settings,

    children: [
      {
        id: "general-overview",
        label: "Overview",
        icon: LayoutDashboard,
      },
      {
        id: "general-users",
        label: "Users",
        icon: Users,
      },
      {
        id: "general-workspaces",
        label: "Workspaces",
        icon: FolderKanban,
      },
      {
        id: "general-boards",
        label: "Boards",
        icon: BarChart3,
      },
      {
        id: "general-media",
        label: "Media",
        icon: HardDrive,
      },
    ],
  },

  {
    id: "templates",
    label: "Board Templates",
    description: "Reusable board structures",
    icon: LayoutTemplate,
  },
] as const;

export function SettingsSidebar() {
  return (
    <TabsList className="h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0">
      {navigation.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.id} className="w-full">
            {/* Main item */}
            <TabsTrigger
              value={item.id}
              className="
                group
                h-auto
                w-full
                justify-start
                gap-3
                rounded-lg
                px-3
                py-3
                text-left
                font-normal
                text-muted-foreground
                shadow-none
                transition-colors

                hover:bg-muted
                hover:text-foreground

                data-[state=active]:bg-primary/10
                data-[state=active]:text-primary
                data-[state=active]:shadow-none
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-muted
                  transition-colors

                  group-data-[state=active]:bg-primary/10
                  group-data-[state=active]:text-primary
                "
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground group-data-[state=active]:text-primary">
                  {item.label}
                </p>

                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>

              {"children" in item && (
                <ChevronDown
                  className="
                    h-4
                    w-4
                    shrink-0
                    text-muted-foreground
                    transition-transform
                    group-data-[state=active]:rotate-180
                  "
                />
              )}
            </TabsTrigger>

            {/* Nested items */}
            {"children" in item && (
              <div className="ml-5 mt-1 border-l pl-3">
                <div className="space-y-0.5">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;

                    return (
                      <TabsTrigger
                        key={child.id}
                        value={child.id}
                        className="
                          group
                          h-9
                          w-full
                          justify-start
                          gap-2.5
                          rounded-md
                          px-3
                          text-left
                          text-sm
                          font-normal
                          text-muted-foreground
                          shadow-none

                          hover:bg-muted
                          hover:text-foreground

                          data-[state=active]:bg-muted
                          data-[state=active]:font-medium
                          data-[state=active]:text-primary
                          data-[state=active]:shadow-none
                        "
                      >
                        <ChildIcon className="h-3.5 w-3.5 shrink-0" />

                        <span>{child.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </TabsList>
  );
}

