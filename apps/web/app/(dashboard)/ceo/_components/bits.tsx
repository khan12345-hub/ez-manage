import { cn } from "@/lib/utils";

/** small BOARDS / WORK tag so same-named companies stay apart */
export function SourceBadge({ source }: { source: "boards" | "work" }) {
  return <span className={cn("rounded px-1.5 py-px font-mono text-[9.5px] font-semibold uppercase tracking-wide", source === "work" ? "bg-product-work/12 text-product-work" : "bg-product-boards/12 text-product-boards dark:text-[#a5b4fc]")}>{source}</span>;
}

export const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
