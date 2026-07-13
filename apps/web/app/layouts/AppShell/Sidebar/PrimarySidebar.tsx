"use client";

import React from "react";
import { 
  LayoutGrid, 
  Sparkles, 
  Bot, 
  Heart, 
  StickyNote, 
  Star, 
  MoreHorizontal,
  Zap,
  User,
  HelpCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PrimarySidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function PrimarySidebar({ activeTab = "Workspace", onTabChange }: PrimarySidebarProps) {
  const menuItems = [
    { id: "Workspace", label: "Workspace", icon: LayoutGrid },
    
  ];

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
                  isActive && "bg-blue-50/70 text-blue-600 border-l-[3px] border-blue-600"
                )}
              >
                <Icon 
                  className={cn(
                    "h-6 w-6 text-gray-500 transition-colors duration-200 group-hover:text-gray-900",
                    isActive && "text-blue-600 group-hover:text-blue-700"
                  )} 
                />
                <span 
                  className={cn(
                    "mt-1.5 text-[10px] font-medium tracking-tight text-gray-400 transition-colors duration-200 group-hover:text-gray-700",
                    isActive && "text-blue-600 font-semibold"
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

      {/* Bottom Profile and Help */}
      <div className="flex w-full flex-col items-center gap-5">
        {/* Upgrade / Notification Dot */}
        <button className="group relative flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <div className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF3D57]" />
        </button>

        {/* User Profile Avatar */}
        <div className="relative h-10 w-10 cursor-pointer rounded-full bg-gradient-to-tr from-pink-500 to-yellow-500 p-[2px] transition-transform hover:scale-105">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
            <span className="text-xs font-bold text-gray-800">MA</span>
          </div>
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
        </div>
      </div>
    </div>
  );
}
