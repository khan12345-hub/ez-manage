"use client";

/** Small SVG charts for Overview / Dashboard cards (no chart library). */

const PALETTE = ["#0B5D3B", "#b08d57", "#2563EB", "#DC2626", "#7C3AED", "#0891B2", "#EA580C", "#DB2777", "#65A30D", "#475569"];
export const colorAt = (i: number) => PALETTE[i % PALETTE.length]!;

export type Slice = { label: string; value: number; color: string };

/** Pie / donut with a legend beside it. */
export function Donut({ data, size = 168, label }: { data: Slice[]; size?: number; label?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = size / 2;
  const inner = r * 0.58;
  let angle = -Math.PI / 2;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      angle = a1;
      const large = sweep > Math.PI ? 1 : 0;
      const p = (rad: number, rr: number) => `${r + rr * Math.cos(rad)} ${r + rr * Math.sin(rad)}`;
      // a full circle needs two arcs
      const path =
        sweep >= Math.PI * 2 - 1e-6
          ? `M ${p(0, r)} A ${r} ${r} 0 1 1 ${p(Math.PI, r)} A ${r} ${r} 0 1 1 ${p(0, r)} M ${p(0, inner)} A ${inner} ${inner} 0 1 0 ${p(Math.PI, inner)} A ${inner} ${inner} 0 1 0 ${p(0, inner)} Z`
          : `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`;
      return { ...d, path };
    });
  if (!total) return <Empty />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? "Chart"} className="shrink-0">
        {arcs.map((a) => (
          <path key={a.label} d={a.path} fill={a.color} fillRule="evenodd" stroke="var(--card)" strokeWidth={1.5}>
            <title>{`${a.label}: ${a.value} (${Math.round((a.value / total) * 100)}%)`}</title>
          </path>
        ))}
        <text x={r} y={r - 2} textAnchor="middle" className="fill-foreground" style={{ fontSize: 20, fontWeight: 600 }}>{total}</text>
        <text x={r} y={r + 15} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10.5 }}>tasks</text>
      </svg>
      <ul className="min-w-[140px] space-y-1.5 text-[12.5px]">
        {data.filter((d) => d.value > 0).map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="font-mono text-[11.5px] text-muted-foreground">{d.value} · {Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One horizontal stacked bar (Workload by Status). */
export function StackBar({ data }: { data: Slice[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <Empty />;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Workload by status">
        {data.filter((d) => d.value).map((d) => (
          <span key={d.label} title={`${d.label}: ${d.value}`} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {data.filter((d) => d.value).map((d) => (
          <li key={d.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
            <span className="uppercase tracking-wide">{d.label}</span>
            <span className="font-mono text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bars with labels under them. */
export function Bars({ data, format = (n: number) => String(n), unit = "Tasks" }: { data: Slice[]; format?: (n: number) => string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.some((d) => d.value)) return <Empty />;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div className="flex h-56 gap-2">
      <div className="flex flex-col justify-between pb-6 text-right font-mono text-[10px] text-muted-foreground">
        {[...ticks].reverse().map((t, i) => <span key={i}>{format(Math.round(t))}</span>)}
      </div>
      <div className="relative mb-6 flex min-w-0 flex-1 items-end gap-3 border-b border-l border-border pl-2">
        {data.map((d) => (
          <div key={d.label} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-mono text-[10.5px] text-muted-foreground">{format(d.value)}</span>
            <span className="w-full max-w-[64px] rounded-t-md" style={{ height: `${(d.value / max) * 85}%`, background: d.color, minHeight: d.value ? 3 : 0 }} title={`${d.label}: ${format(d.value)} ${unit}`} />
            <span className="absolute -bottom-5 w-full truncate text-center text-[11px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">No Results</p>;
}
