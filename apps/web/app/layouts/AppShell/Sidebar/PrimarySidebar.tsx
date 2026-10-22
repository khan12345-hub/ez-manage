"use client";

import React from "react";
import {
  LayoutGrid,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface PrimarySidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function PrimarySidebar({
  activeTab = "Workspace",
  onTabChange,
}: PrimarySidebarProps) {
  const menuItems = [{ id: "Workspace", label: "Workspace", icon: LayoutGrid }];
  const pathname = usePathname();
  const isHelp = pathname === "/help";
  return (
    <div className="flex h-full w-[80px] flex-col items-center justify-between border-r border-border bg-background py-5 shadow-sm">
      {/* Top Logo and Main Menu Items */}
      <div className="flex w-full flex-col items-center gap-8">
        {/* EzManage brand mark — three task bars on indigo gradient */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[8px] cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #6361F0 0%, #4845E4 100%)" }}
          aria-label="EzManage"
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0"   width="18" height="2.5" rx="1.25" fill="white" fillOpacity="0.92" />
            <rect x="0" y="6.5" width="13" height="2.5" rx="1.25" fill="white" fillOpacity="0.70" />
            <rect x="0" y="13"  width="8"  height="2.5" rx="1.25" fill="white" fillOpacity="0.48" />
          </svg>
        </div>

        {/* Menu Items */}
        <nav className="flex w-full flex-col items-center gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className={cn(
                  "group relative flex w-full flex-col items-center justify-center py-2.5 transition-all duration-200 hover:bg-muted",
                  isActive &&
                    "bg-primary/10 text-primary border-l-[3px] border-primary",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
                    isActive && "text-primary group-hover:text-primary",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 text-[10px] font-medium tracking-tight text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
                    isActive && "text-primary font-semibold",
                  )}
                >
                  {item.label}
                </span>
                {/* Tooltip */}
                <div className="absolute left-[84px] z-50 hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100 whitespace-nowrap shadow-md">
                  {item.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Help */}
      <div className="flex w-full flex-col items-center gap-2 pb-2">
        <Link
          href="/help"
          className={cn(
            "group relative flex w-full flex-col items-center justify-center py-2.5 transition-all duration-200 hover:bg-muted",
            isHelp && "bg-primary/10 text-primary border-l-[3px] border-primary",
          )}
        >
          <HelpCircle
            className={cn(
              "h-6 w-6 text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
              isHelp && "text-primary",
            )}
          />
          <span
            className={cn(
              "mt-1.5 text-[10px] font-medium tracking-tight text-muted-foreground transition-colors duration-200 group-hover:text-foreground",
              isHelp && "text-primary font-semibold",
            )}
          >
            Help
          </span>
          <div className="absolute left-[84px] z-50 hidden rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100 whitespace-nowrap shadow-md">
            Help & Guide
          </div>
        </Link>
      </div>
    </div>
  );
}

