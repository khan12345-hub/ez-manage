"use client";

import {
  BarChart3,
  CheckSquare,
  Database,
  FolderKanban,
  HardDrive,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { StatCard } from "./StatCard";

const stats = [
  {
    title: "Users",
    value: "128",
    description: "+8 this month",
    icon: Users,
  },
  {
    title: "Workspaces",
    value: "24",
    description: "12 active",
    icon: FolderKanban,
  },
  {
    title: "Boards",
    value: "87",
    description: "64 active",
    icon: BarChart3,
  },
  {
    title: "Tasks",
    value: "18,492",
    description: "12,840 completed",
    icon: CheckSquare,
  },
  {
    title: "Media",
    value: "4.82 GB",
    description: "1,284 files",
    icon: HardDrive,
  },
];

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          System Overview
        </h2>

        <p className="text-sm text-muted-foreground">
          Monitor the entire EzManage system.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StorageCard />
        <SystemStatus />
      </div>
    </div>
  );
}

function StorageCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Storage usage
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">
              4.82 GB used
            </span>

            <span className="font-medium">48%</span>
          </div>

          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: "48%" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StorageItem label="Images" value="2.1 GB" />
          <StorageItem label="Videos" value="1.8 GB" />
          <StorageItem label="Documents" value="0.7 GB" />
        </div>
      </CardContent>
    </Card>
  );
}

function StorageItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function SystemStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          System status
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <StatusRow
          label="Database"
          icon={Database}
        />

        <StatusRow
          label="Storage"
          icon={HardDrive}
        />

        <StatusRow
          label="Permissions"
          icon={ShieldCheck}
        />
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  icon: Icon,
}: {
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>

      <Badge variant="secondary">Healthy</Badge>
    </div>
  );
}

