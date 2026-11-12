"use client";

import Link from "next/link";
import { BarChart3, LayoutGrid, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProductAccess } from "@/hooks/useProductAccess";
import { useCeoAccess } from "@/services/ceo-tower.api";

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

const PRODUCT_META = {
  boards: { label: "Boards", icon: LayoutGrid, tint: "bg-product-boards", text: "text-product-boards dark:text-[#a5b4fc]", ring: "ring-product-boards/40" },
  work: { label: "Work", icon: ListChecks, tint: "bg-product-work", text: "text-product-work dark:text-[#6ee7b7]", ring: "ring-product-work/40" },
  ceo: { label: "CEO", icon: BarChart3, tint: "bg-product-ceo", text: "text-product-ceo", ring: "ring-product-ceo/40" },
} as const;

/**
 * Product switcher: compact tiles. Only products this person can open are shown
 * (Boards and Work have separate access); CEO Tower shows for workspace owners.
 */
export function ProductSwitcher({
  active,
  boardsHref,
  workHref,
  showCeo,
  onNavigate,
}: {
  active: ProductKey;
  boardsHref?: string;
  workHref?: string;
  showCeo: boolean;
  onNavigate?: () => void;
}) {
  const access = useProductAccess();
  const ceo = useCeoAccess();
  void showCeo; // kept for callers; CEO Tower now follows ownership, not the platform role
  const items: { key: ProductKey; href?: string; soon?: boolean }[] = [];
  if (active === "boards" || access.hasBoards) items.push({ key: "boards", href: active === "boards" ? boardsHref : boardsHref ?? access.boardsHref });
  if (active === "work" || !access.loading) items.push({ key: "work", href: active === "work" ? workHref : workHref ?? access.workHref ?? "/work/create" });
  if (ceo.allowed) items.push({ key: "ceo", href: "/ceo" });
  if (items.length < 2) return null; // only one product: no switcher needed

  return (
    <nav aria-label="Products" className="px-4 pt-3">
      <div className={cn("grid gap-1.5 rounded-xl bg-muted/50 p-1 ring-1 ring-border/60", items.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {items.map((item) => {
          const m = PRODUCT_META[item.key];
          const isActive = item.key === active;
          const body = (
            <>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-white shadow-sm", m.tint, item.soon && "opacity-50")}>
                <m.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span className={cn("text-[11.5px] font-semibold leading-none", isActive ? "text-foreground" : "text-muted-foreground")}>{m.label}</span>
              {item.soon && <span className="text-[8.5px] font-semibold uppercase tracking-wide text-muted-foreground/70">Soon</span>}
            </>
          );
          const cls = cn(
            "flex flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 transition-all",
            isActive ? cn("bg-card shadow-sm ring-1", m.ring) : item.soon ? "cursor-not-allowed" : "hover:bg-card/70",
          );
          return item.href && !item.soon && !isActive ? (
            <Link key={item.key} href={item.href} onClick={onNavigate} className={cls} aria-label={`Open ${m.label}`}>
              {body}
            </Link>
          ) : (
            <span key={item.key} className={cls} aria-current={isActive ? "page" : undefined} aria-disabled={item.soon || undefined} title={item.soon ? "Being built" : undefined}>
              {body}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
