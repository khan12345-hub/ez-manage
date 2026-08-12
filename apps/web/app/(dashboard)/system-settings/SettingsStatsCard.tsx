import { Card, CardContent } from "@/components/ui/card";

interface SettingsStatCardProps {
  label: string;
  value: string | number;
  description: string;
}

export function SettingsStatCard({
  label,
  value,
  description,
}: SettingsStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">
          {label}
        </p>

        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {value}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}