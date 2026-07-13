interface Props {
  cell?: any;
}

export function TextCell({ cell }: Props) {
  if (!cell) return <>—</>;

  return <>{cell.value?.text ?? "—"}</>;
}