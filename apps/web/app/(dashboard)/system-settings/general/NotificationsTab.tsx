"use client";

import { Bell, Mail } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/users.api";

export function NotificationsTab() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: getNotificationPreferences,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(["notification-preferences"], updated);
    },
    onError: () => {
      toast.error("Failed to save notification settings");
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  function toggle(key: "emailNotificationsEnabled" | "inAppNotificationsEnabled") {
    if (!prefs || mutation.isPending) return;
    mutation.mutate({ [key]: !prefs[key] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Control how and when you receive notifications.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notification channels</CardTitle>
        </CardHeader>

        <CardContent className="divide-y">
          <NotifRow
            icon={Bell}
            label="In-app notifications"
            description="Receive notifications inside EzManage (bell icon)."
            checked={prefs?.inAppNotificationsEnabled ?? true}
            isLoading={isLoading}
            disabled={mutation.isPending}
            onToggle={() => toggle("inAppNotificationsEnabled")}
          />

          <NotifRow
            icon={Mail}
            label="Email notifications"
            description="Get email alerts for important activity and mentions."
            checked={prefs?.emailNotificationsEnabled ?? true}
            isLoading={isLoading}
            disabled={mutation.isPending}
            onToggle={() => toggle("emailNotificationsEnabled")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NotifRow({
  icon: Icon,
  label,
  description,
  checked,
  isLoading,
  disabled,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  isLoading: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <Label className="text-sm font-medium leading-none">{label}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-6 w-11 rounded-full" />
      ) : (
        <Switch
          checked={checked}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      )}
    </div>
  );
}
