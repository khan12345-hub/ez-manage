"use client";

import {
  CheckCircle2,
  Clock3,
  ListTodo,
  TriangleAlert,
} from "lucide-react";

const stats = [
  {
    title: "My Tasks",
    value: "24",
    description: "Assigned to you",
    icon: ListTodo,
  },
  {
    title: "Due Today",
    value: "5",
    description: "Need your attention",
    icon: Clock3,
  },
  {
    title: "Overdue",
    value: "2",
    description: "Past their due date",
    icon: TriangleAlert,
  },
  {
    title: "Completed",
    value: "18",
    description: "Completed this week",
    icon: CheckCircle2,
  },
];

export function DashboardStats() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.title}
            className="group rounded-2xl border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>

                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>

              <div className="rounded-xl bg-muted p-2.5">
                <Icon className="size-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}