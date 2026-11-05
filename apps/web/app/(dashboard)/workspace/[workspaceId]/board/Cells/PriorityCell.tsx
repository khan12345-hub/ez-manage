interface Props {
  cell?: any;
}

const PILL: Record<string, { bg: string; text: string; dot: string }> = {
  Low: { bg: "#DBEAFE", text: "#2563EB", dot: "#60A5FA" },
  Medium: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  High: { bg: "#FEE2E2", text: "#DC2626", dot: "#F87171" },
};

export function PriorityCell({ cell }: Props) {
  if (!cell) return <>—</>;

  const label = cell.value?.label ?? "—";
  if (label === "—") return <span className="text-muted-foreground">—</span>;

  const p = PILL[label] ?? { bg: "#EEF1FF", text: "#536A9A", dot: "#8292B5" };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: p.bg, color: p.text }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: p.dot }}
        aria-hidden
      />
      {label}
    </span>
  );
}
