"use client";

import { DashboardHeader } from "./DashboardHeader";
import { MyBoards } from "./Myboards";
import { WorkspaceCards } from "./WorkspaceCards";
export default function DashboardPage() {
  return (
    <div className="min-h-full bg-muted/30">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <DashboardHeader />
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
