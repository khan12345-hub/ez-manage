interface Props {
  cell?: any;
}

export function StatusCell({ cell }: Props) {
  console.log("Status cell before", cell);
  if (!cell) return <>—</>;
  console.log("Status cell after", cell);
  return (
    <div
      style={{ backgroundColor: cell.color }}
      className={`rounded text-center text-white`}
    >
      {cell.label ?? "—"}
    </div>
  );
}
