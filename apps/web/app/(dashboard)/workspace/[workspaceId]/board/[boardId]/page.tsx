"use client";

import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getBoardDetail } from "@/services/boards.api";
import { useGroupStore } from "@/store/create-group-store";
import { TaskDetailsSheet } from "../Task/TaskDetailDrawer/Updates/TaskDetailsDrawer";
import { Board } from "./Board";

export default function BoardPage() {
  const { setGroups } = useGroupStore();
  const params = useParams();

  const boardId = Number(params.boardId);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  const {
    data: board,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["board", boardId, debouncedSearch],
    queryFn: () => getBoardDetail(boardId, debouncedSearch),
    enabled: Number.isFinite(boardId),
    retry: 0,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (board?.groups) {
      setGroups(board.groups);
    }
  }, [board, setGroups]);



  return (
    <>
      <div className="bg-background p-6">
        <Board
          board={board ?? []}
          search={search}
          setSearch={setSearch}
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
        />
      </div>

      <TaskDetailsSheet />
    </>
  );
}
