"use client";

/* The one page header for Work pages: icon tile, title (+ count), subtitle, actions on the right. */

import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, subtitle, count, actions, color, children }: {
  icon: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  /** tile colour (hex); the brand green when left out */
  color?: string;
  /** an extra row under the title (tabs, filters…) */
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          style={color ? { background: `${color}1a`, color } : undefined}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 basis-[180px]">
          <h1 className="flex items-baseline gap-2 text-[22px] font-semibold leading-tight tracking-tight">
            <span className="truncate">{title}</span>
            {count !== undefined && count !== null && <span className="shrink-0 text-[14px] font-medium text-muted-foreground">{count}</span>}
          </h1>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </header>
  );
}
