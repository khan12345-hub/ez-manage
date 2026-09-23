"use client";

import React from "react";
import {
  LayoutGrid,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
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
  const { user } = useAuth();
  const pathname = usePathname();
  const isHelp = pathname === "/help";
  return (
    <div className="flex h-full w-[80px] flex-col items-center justify-between border-r border-gray-200 bg-white py-5 shadow-sm">
      {/* Top Logo and Main Menu Items */}
      <div className="flex w-full flex-col items-center gap-8">
        {/* Custom Monday-like Logo */}
        <div className="flex h-9 w-9 items-center justify-center relative cursor-pointer group">
          <div className="grid grid-cols-2 gap-1.5 w-7 h-7 rotate-45 transition-transform duration-300 group-hover:rotate-90">
            <div className="bg-[#FF3D57] rounded-sm"></div>
            <div className="bg-[#00CFF4] rounded-sm"></div>
            <div className="bg-[#FFCB00] rounded-sm"></div>
            <div className="bg-[#00C875] rounded-sm"></div>
          </div>
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
                  "group relative flex w-full flex-col items-center justify-center py-2.5 transition-all duration-200 hover:bg-gray-100/85",
                  isActive &&
                    "bg-blue-50/70 text-blue-600 border-l-[3px] border-blue-600",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 text-gray-500 transition-colors duration-200 group-hover:text-gray-900",
                    isActive && "text-blue-600 group-hover:text-blue-700",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 text-[10px] font-medium tracking-tight text-gray-400 transition-colors duration-200 group-hover:text-gray-700",
                    isActive && "text-blue-600 font-semibold",
                  )}
                >
                  {item.label}
                </span>
                {/* Tooltip */}
                <div className="absolute left-[84px] z-50 hidden rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100 whitespace-nowrap shadow-md">
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
            "group relative flex w-full flex-col items-center justify-center py-2.5 transition-all duration-200 hover:bg-gray-100/85",
            isHelp && "bg-blue-50/70 text-blue-600 border-l-[3px] border-blue-600",
          )}
        >
          <HelpCircle
            className={cn(
              "h-6 w-6 text-gray-500 transition-colors duration-200 group-hover:text-gray-900",
              isHelp && "text-blue-600",
            )}
          />
          <span
            className={cn(
              "mt-1.5 text-[10px] font-medium tracking-tight text-gray-400 transition-colors duration-200 group-hover:text-gray-700",
              isHelp && "text-blue-600 font-semibold",
            )}
          >
            Help
          </span>
          <div className="absolute left-[84px] z-50 hidden rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:block group-hover:opacity-100 whitespace-nowrap shadow-md">
            Help & Guide
          </div>
        </Link>
      </div>
    </div>
  );
}
