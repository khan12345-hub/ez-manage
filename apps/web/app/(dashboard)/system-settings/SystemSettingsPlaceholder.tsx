import { Settings } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface SettingsPlaceholderProps {
  title: string;
}

export function SettingsPlaceholder({
  title,
}: SettingsPlaceholderProps) {
  return (
    <Card>
      <CardContent className="flex min-h-80 items-center justify-center">
        <div className="text-center">
          <Settings className="mx-auto h-8 w-8 text-muted-foreground" />

          <h2 className="mt-4 text-lg font-semibold">
            {title}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            This settings section is coming soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}