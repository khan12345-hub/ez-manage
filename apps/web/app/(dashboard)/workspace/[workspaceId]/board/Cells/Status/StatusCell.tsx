interface Props {
  cell?: any;
}

export function StatusCell({ cell }: Props) {
  if (!cell) return <>—</>;
  return (
    <button
      className="absolute top-0 left-0 flex h-full w-full cursor-pointer items-center justify-center text-[13px] font-semibold tracking-wide text-white"
      style={{
        background: cell?.color ?? cell?.color ?? "#c4c4c4",
      }}
    >
      {cell?.label ?? cell?.label ?? "Not Started"}
    </button>
  );
}
