"use client";

import { BoardTemplates } from "./SystemSettingsBoardTemplates";
import { SettingsPlaceholder } from "./SystemSettingsPlaceholder";
import { SettingsSidebar } from "./SystemSettingsSidebar";

import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="text-sm text-muted-foreground">
            Settings 
            
            <span className="text-foreground">System</span>
          </div>

          <div className="mt-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              System Settings
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Configure system-wide preferences and manage your
              EzManage workspace.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <Tabs
          defaultValue="templates"
          orientation="vertical"
          className="flex w-full flex-row gap-8"
        >
          {/* Sidebar */}
          <SettingsSidebar />

          {/* Content */}
          <main className="min-w-0 flex-1">
            <TabsContent value="templates" className="mt-0">
              <BoardTemplates />
            </TabsContent>

            <TabsContent value="general" className="mt-0">
              <SettingsPlaceholder title="General" />
            </TabsContent>

            <TabsContent value="users" className="mt-0">
              <SettingsPlaceholder title="Users & Permissions" />
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <SettingsPlaceholder title="Notifications" />
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <SettingsPlaceholder title="Security" />
            </TabsContent>
          </main>
        </Tabs>
      </div>
    </div>
  );
}