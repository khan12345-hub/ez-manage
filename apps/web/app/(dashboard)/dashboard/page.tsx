"use client";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
import { TaskOverviewChart } from "./TaskOverviewChart";
import { TaskDistribution } from "./TaskDistribution";
import { RecentTasksTable } from "./RecentTasksTable";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { RecentActivity } from "./RecentActivity";
import { QuickActions } from "./QuickActions";

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-[linear-gradient(160deg,#f0f1ff_0%,#eeeffe_50%,#f4f0ff_100%)] dark:bg-none dark:bg-background">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
          {/* ── Main column ───────────────────────────────────────────── */}
          <div className="min-w-0 space-y-6">
            <DashboardHeader />

            <DashboardStats />

            {/* Charts row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
              <TaskOverviewChart />
              <TaskDistribution />
            </div>

            {/* Tasks + meetings row */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
              <RecentTasksTable />
              <UpcomingMeetings />
            </div>
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="space-y-6">
            <QuickActions />
            <RecentActivity />
          </div>
        </div>
      </div>
    </div>
  );
}
