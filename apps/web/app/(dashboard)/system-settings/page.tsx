"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { ChevronRight, Settings2 } from "lucide-react";

import { Tabs, TabsContent } from "@/components/ui/tabs";

import { BoardTemplates } from "./SystemSettingsBoardTemplates";
import { GeneralSettings } from "./SystemSettingsGeneral";
import { SettingsPlaceholder } from "./SystemSettingsPlaceholder";
import { SettingsSidebar } from "./SystemSettingsSidebar";
import { OverviewTab } from "./general/OverviewTab";
import { UsersTab } from "./general/UsersTab";
import { WorkspacesTab } from "./general/WorkspacesTab";
import { BoardsTab } from "./general/BoardsTab";
import { MediaTab } from "./general/MediaTab";
import { NotificationsTab } from "./general/NotificationsTab";
import { IntegrationsTab } from "./general/IntegrationsTab";
export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.systemRole !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user || user.systemRole !== "SUPER_ADMIN") return null;

  return (
    <div className="min-h-full bg-muted/20">
      <Tabs
        defaultValue="general"
        orientation="vertical"
        className="flex min-h-full flex-col"
      >
        {/* Header */}
        <header className="border-b bg-background">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-6 lg:px-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Administration</span>

              <ChevronRight className="h-3.5 w-3.5" />

              <span className="font-medium text-foreground">
                System Settings
              </span>
            </div>

            {/* Heading */}
            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  System Settings
                </h1>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Configure system-wide preferences and manage your EzManage
                  environment.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-6 py-6 lg:px-8 lg:py-8">
          <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            {/* Sidebar */}
            <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64">
              <div className="rounded-xl border bg-background p-2 shadow-sm">
                <SettingsSidebar />
              </div>
            </aside>

            {/* Main content */}
            <main className="min-w-0 flex-1">
              <div className="rounded-xl border bg-background shadow-sm">
                <div className="p-6 lg:p-8">
                  <TabsContent
                    value="general"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <OverviewTab />
                  </TabsContent>

                  <TabsContent value="general-overview" className="mt-0">
                    <OverviewTab />
                  </TabsContent>

                  <TabsContent value="general-users" className="mt-0">
                    <UsersTab />
                  </TabsContent>

                  <TabsContent value="general-workspaces" className="mt-0">
                    <WorkspacesTab />
                  </TabsContent>

                  <TabsContent value="general-boards" className="mt-0">
                    <BoardsTab />
                  </TabsContent>

                  <TabsContent value="general-media" className="mt-0">
                    <MediaTab />
                  </TabsContent>

                  <TabsContent value="general-integrations" className="mt-0">
                    <IntegrationsTab />
                  </TabsContent>

                  <TabsContent
                    value="templates"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <BoardTemplates />
                  </TabsContent>

                  <TabsContent
                    value="users"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <SettingsPlaceholder title="Users & Permissions" />
                  </TabsContent>

                  <TabsContent
                    value="notifications"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <NotificationsTab />
                  </TabsContent>

                  <TabsContent
                    value="security"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <SettingsPlaceholder title="Security" />
                  </TabsContent>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
