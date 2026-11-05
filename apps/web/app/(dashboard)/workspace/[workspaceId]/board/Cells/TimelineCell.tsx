import { format } from "date-fns";
import { parseDateValue } from "@/lib/date-value";

interface TimelineValue {
  startDate?: string | Date;
  endDate?: string | Date;
}

interface Props {
  cell?: TimelineValue | any;
}

export function TimelineCell({ cell }: Props) {
  if (!cell?.startDate || !cell?.endDate) {
    return <>—</>;
  }

  const startDate = parseDateValue(cell.startDate);
  const endDate = parseDateValue(cell.endDate);
  if (!startDate || !endDate) {
    return <>—</>;
  }

  return (
    <span className="whitespace-nowrap">
      {format(startDate, "dd MMM yyyy")} -{" "}
      {format(endDate, "dd MMM yyyy")}
    </span>
  );
}