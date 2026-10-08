import { format, isValid } from "date-fns";
import { AlertCircle } from "lucide-react";

interface Props {
  cell?: any;
  /** When true, never shows the overdue red style — use for non-deadline dates */
  plain?: boolean;
}
export function DateCell({ cell, plain = false }: Props) {
  if (!cell) return <>—</>;
  const raw = cell.date;
  if (!raw) return <>—</>;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (!isValid(date)) return <>—</>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = !plain && date < today;

  return (
    <span className={isOverdue ? "flex items-center gap-1 text-red-500" : undefined}>
      {isOverdue && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
      {format(date, "dd MMM yyyy")}
    </span>
  );
}
