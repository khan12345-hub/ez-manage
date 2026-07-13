interface Props {
  cell?: any;
}

export function DateCell({ cell }: Props) {
  if (!cell) return <>—</>;

  return <>{cell.value?.date ?? "—"}</>;
}