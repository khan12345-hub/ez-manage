import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchBoardTasks } from "@/services/boards.api";

export function useBoardSearch(boardId: number) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const query = useQuery({
    queryKey: ["board-task-search", boardId, debouncedSearch],
    queryFn: () =>
      searchBoardTasks({
        boardId,
        query: debouncedSearch,
      }),
    enabled: Boolean(boardId && debouncedSearch),
    staleTime: 30_000,
  });

  return {
    search,
    setSearch,
    debouncedSearch,
    results: query.data ?? [],
    isSearching: query.isFetching,
  };
}

