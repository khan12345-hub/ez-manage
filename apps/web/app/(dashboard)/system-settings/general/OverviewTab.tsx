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

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./StatCard";
import { getSystemOverview } from "@/services/admin.api";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getSystemOverview,
    staleTime: 60_000,
  });

  const stats = [
    {
      title: "Users",
      value: isLoading ? "—" : formatNumber(data?.users.total ?? 0),
      description: isLoading
        ? ""
        : `+${data?.users.newThisMonth ?? 0} this month`,
      icon: Users,
    },
    {
      title: "Workspaces",
      value: isLoading ? "—" : formatNumber(data?.workspaces.total ?? 0),
      description: "",
      icon: FolderKanban,
    },
    {
      title: "Boards",
      value: isLoading ? "—" : formatNumber(data?.boards.total ?? 0),
      description: "",
      icon: BarChart3,
    },
    {
      title: "Tasks",
      value: isLoading ? "—" : formatNumber(data?.tasks.total ?? 0),
      description: "",
      icon: CheckSquare,
    },
    {
      title: "Media",
      value: isLoading ? "—" : formatBytes(data?.storage.totalBytes ?? 0),
      description: isLoading
        ? ""
        : `${formatNumber(data?.storage.totalFiles ?? 0)} files`,
      icon: HardDrive,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">System Overview</h2>
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
        <StorageCard data={data?.storage} isLoading={isLoading} />
        <SystemStatus />
      </div>
    </div>
  );
}

function StorageCard({
  data,
  isLoading,
}: {
  data?: {
    totalBytes: number;
    imageBytes: number;
    videoBytes: number;
    docBytes: number;
  };
  isLoading: boolean;
}) {
  const total = data?.totalBytes ?? 0;
  const maxBytes = Math.max(total, 1);
  const usedPct = Math.min(Math.round((total / (10 * 1024 * 1024 * 1024)) * 100), 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Storage usage</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatBytes(total)} used
              </span>
              <span className="font-medium">{usedPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </>
          ) : (
            <>
              <StorageItem label="Images" value={formatBytes(data?.imageBytes ?? 0)} />
              <StorageItem label="Videos" value={formatBytes(data?.videoBytes ?? 0)} />
              <StorageItem label="Documents" value={formatBytes(data?.docBytes ?? 0)} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StorageItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SystemStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">System status</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <StatusRow label="Database" icon={Database} />
        <StatusRow label="Storage" icon={HardDrive} />
        <StatusRow label="Permissions" icon={ShieldCheck} />
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
