"use client";

import { AppSwitcher } from "@/components/AppSwitcher";

import Link from "next/link";
import { BarChart3, KeyRound, LayoutGrid, ListChecks } from "lucide-react";
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

export type ProductKey = "boards" | "work" | "ceo" | "vault";

const PRODUCT_META = {
  boards: { label: "Accounts", icon: LayoutGrid, tint: "bg-product-boards", text: "text-product-boards dark:text-[#a5b4fc]", ring: "ring-product-boards/40" },
  work: { label: "Work", icon: ListChecks, tint: "bg-product-work", text: "text-product-work dark:text-[#6ee7b7]", ring: "ring-product-work/40" },
  ceo: { label: "Executive", icon: BarChart3, tint: "bg-product-ceo", text: "text-product-ceo", ring: "ring-product-ceo/40" },
  vault: { label: "Vault", icon: KeyRound, tint: "bg-product-vault", text: "text-product-vault", ring: "ring-product-vault/40" },
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
  if (active === "work" || access.hasWork) items.push({ key: "work", href: active === "work" ? workHref : workHref ?? access.workHref });
  if (ceo.allowed) items.push({ key: "ceo", href: "/ceo" });
  // EZ Vault (password manager) is for everyone
  items.push({ key: "vault", href: "/vault" });
  if (items.length < 2) return null; // only one product: no switcher needed

  return (
    <div className="px-3 pt-3">
      <AppSwitcher active={active} hrefs={{ boards: boardsHref, work: workHref }} onNavigate={onNavigate} />
    </div>
  );
}
