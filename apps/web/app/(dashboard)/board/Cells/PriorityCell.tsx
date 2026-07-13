interface Props {
  cell?: any;
}

const colors: Record<string, string> = {
  Low: "bg-blue-500",
  Medium: "bg-yellow-500",
  High: "bg-red-500",
};

export function PriorityCell({ cell }: Props) {
  if (!cell) return <>—</>;

  const label = cell.value?.label ?? "—";

  return (
    <div
      className={`rounded px-2 py-1 text-center text-white ${
        colors[label] ?? "bg-gray-500"
      }`}
    >
      {label}
    </div>
  );
}