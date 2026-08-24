interface Props {
  cell?: any;
}

export function StatusCell({ cell }: Props) {
  console.log("Status cell before", cell);
  if (!cell) return <>—</>;
  console.log("Status cell after", cell);
  return (
    <button
      className="absolute top-0 truncate left-0 flex h-full w-full cursor-pointer items-center justify-center text-sm font-medium text-white"
      style={{
        background: cell?.color ?? cell?.color ?? "#c4c4c4",
      }}
    >
      {cell?.label ?? cell?.label ?? "Not Started"}
    </button>
  );
}
