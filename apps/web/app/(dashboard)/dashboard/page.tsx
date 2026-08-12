"use client";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardStats } from "./DashboardStats";
import { MyBoards } from "./Myboards";
import { MyTasks } from "./MyTasks";
import { WorkspaceCards } from "./WorkspaceCards";
export default function DashboardPage() {
  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        <DashboardHeader />
        <div className="mt-6">
          <DashboardStats />
        </div>

        <div className="mt-8">
          <MyTasks />
        </div>

        <div className="mt-8">
          <WorkspaceCards />
        </div>
        <div className="mt-8 pb-10">
          <MyBoards />
        </div>
      </div>
    </div>
  );
}