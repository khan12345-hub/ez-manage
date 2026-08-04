"use client";

import {
  Loader2,
  ChevronRight,
} from "lucide-react";


import { TaskActivityItem } from "./TaskActivityItem";
import { useTaskActivities } from "./useTaskActivities";



interface TaskActivityFeedProps {
  taskId: number;
}

export function TaskActivityFeed({
  taskId,
}: TaskActivityFeedProps) {
  const {
    data,
    isLoading,
    isError,
  } = useTaskActivities(taskId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Failed to load activity.
      </div>
    );
  }

  if (!data?.pages[0]?.data?.length) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      {data.pages.flatMap((page) => page.data).map((activity:any) => (
        <TaskActivityItem
          key={activity.id}
          activity={activity}
        />
      ))}

      
    </div>
  );
}