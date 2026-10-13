"use client";

import { createContext, useContext } from "react";

const SearchHighlightContext = createContext<string>("");

export function SearchHighlightProvider({
  children,
  search,
}: {
  children: React.ReactNode;
  search: string;
}) {
  return (
    <SearchHighlightContext.Provider value={search.trim().toLowerCase()}>
      {children}
    </SearchHighlightContext.Provider>
  );
}

export function useSearchHighlight() {
  return useContext(SearchHighlightContext);
}
