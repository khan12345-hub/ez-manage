import { format } from "date-fns";

interface Props {
  cell?: any;
}
export function DateCell({ cell }: Props) {
  if (!cell) return <>—</>;
  const date = cell.date;
  // const formattedDate = new Date(date)
  //   .toLocaleDateString("en-GB")
  //   .replace(/\//g, "-");

   const formattedDate = format(date, "dd MMM yyyy")
  return <>{formattedDate ?? "—"} 2</>;
}
