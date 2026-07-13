"use client";
import React from "react";
import { Search } from "lucide-react";
export function Searchbar() {
  return (
    <div className="relative w-full max-w-[500px]">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <Search className="h-4.5 w-4.5 text-gray-400" />
      </div>
      <input
        type="search"
        placeholder="Search for anything..."
        className="block w-full rounded-full border border-gray-200 bg-gray-50/50 py-4 pl-11! pr-14 text-[13px] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 shadow-sm p-3!"
      />
      
    </div>
  );
}
