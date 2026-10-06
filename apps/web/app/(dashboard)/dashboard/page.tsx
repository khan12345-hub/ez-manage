"use client";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
import { MyBoards } from "./Myboards";
import { WorkspaceCards } from "./WorkspaceCards";
import { QuickActions } from "./QuickActions";

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Hero header */}
        <DashboardHeader />

        {/* KPI stat cards */}
        <div className="mt-6">
          <DashboardStats />
        </div>

        {/* Main content — 2 columns on large screens */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left — workspaces + boards */}
          <div className="space-y-6 lg:col-span-2">
            <WorkspaceCards />
            <MyBoards />
          </div>

          {/* Right — quick actions + resources */}
          <div className="lg:col-span-1">
            <QuickActions />
          </div>
        </div>

      </div>
    </div>
  );
}
