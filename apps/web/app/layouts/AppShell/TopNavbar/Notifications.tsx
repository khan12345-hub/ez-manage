"use client";

import React, { useState } from "react";
import { Bell } from "lucide-react";

export function Notifications() {
  const [unreadCount, setUnreadCount] = useState(3);

  return (
    <button 
      onClick={() => setUnreadCount(0)}
      className="relative rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF3D57] text-[9px] font-bold text-white ring-2 ring-white">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
