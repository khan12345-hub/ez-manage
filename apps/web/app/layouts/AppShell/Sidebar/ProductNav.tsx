"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Forest tile with a serif brass "EZ": the Ledger brand mark. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[8px] bg-forest font-serif leading-none text-brass-soft ring-1 ring-brass/40"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.56) }}
    >
      EZ
    </span>
  );
}

export type ProductKey = "boards" | "work" | "ceo";

/** Product switcher: Boards / Work / CEO Tower, matching the home cards. */
export function ProductSwitcher({
  active,
  boardsHref,
  workHref,
  showCeo,
  onNavigate,
}: {
  active: ProductKey;
  boardsHref: string;
  /** Work product link; omitted = shown as "Soon" */
  workHref?: string;
  showCeo: boolean;
  onNavigate?: () => void;
}) {
  const items: { key: ProductKey; label: string; dot: string; href?: string; note?: string }[] = [
    { key: "boards", label: "Boards", dot: "bg-product-boards", href: boardsHref },
    workHref
      ? { key: "work", label: "Work", dot: "bg-product-work", href: workHref }
      : { key: "work", label: "Work", dot: "bg-product-work", note: "Soon" },
    ...(showCeo
      ? [{ key: "ceo" as const, label: "CEO Tower", dot: "bg-product-ceo", note: "Soon" }] // disabled for now
      : []),
  ];

  return (
    <nav aria-label="Products" className="px-4 pt-3">
      <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        Products
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = item.key === active;
          const cls = cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            isActive
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : item.href
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "cursor-not-allowed text-muted-foreground/60",
          );
          const body = (
            <>
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", item.dot, !item.href && "opacity-50")} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.note && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.note}
                </span>
              )}
            </>
          );
          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cls}
            >
              {body}
            </Link>
          ) : (
            <span key={item.key} aria-disabled="true" title="Being built" className={cls}>
              {body}
            </span>
          );
        })}
      </div>
    </nav>
  );
}

