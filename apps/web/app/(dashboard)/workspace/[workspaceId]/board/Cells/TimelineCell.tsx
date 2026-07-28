import { format } from "date-fns";

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

  const startDate = new Date(cell.startDate);
  const endDate = new Date(cell.endDate);

  return (
    <span className="whitespace-nowrap">
      {format(startDate, "dd MMM yyyy")} -{" "}
      {format(endDate, "dd MMM yyyy")}
    </span>
  );
}