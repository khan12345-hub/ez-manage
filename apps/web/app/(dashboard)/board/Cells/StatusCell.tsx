interface Props {
  cell?: any;
}

export function StatusCell({ cell }: Props) {
  if (!cell) return <>—</>;

  return (
    <div className="rounded bg-gray-600 px-2 py-1 text-center text-white">
      {cell.value?.label ?? "—"}
    </div>
  );
}