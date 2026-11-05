interface Props {
  cell?: any;
}

export function StatusCell({ cell }: Props) {
  if (!cell) return <>—</>;

  const color: string = cell?.color ?? "#8292B5";
  const label: string = cell?.label ?? "Not Started";
  // 6-digit hex → append alpha for a soft tinted background; otherwise fall back.
  const isHex6 = /^#[0-9a-fA-F]{6}$/.test(color);
  const tint = isHex6 ? `${color}22` : color;

  return (
    <button
      type="button"
      className="absolute left-0 top-0 flex h-full w-full cursor-pointer items-center justify-center px-2"
    >
      <span
        className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[12px] font-semibold"
        style={{ background: tint, color }}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}
