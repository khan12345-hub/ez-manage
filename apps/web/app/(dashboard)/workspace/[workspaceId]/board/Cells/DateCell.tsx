interface Props {
  cell?: any;
}
export function DateCell({ cell }: Props) {
  if (!cell) return <>—</>;
  const date = cell.date;
  const formattedDate = new Date(date)
    .toLocaleDateString("en-GB")
    .replace(/\//g, "-");
  return <>{formattedDate ?? "—"}</>;
}
