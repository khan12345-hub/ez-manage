"use client";

import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getBoardDetail } from "@/services/boards.api";
import { useGroupStore } from "@/store/create-group-store";

import { TaskDetailsSheet } from "../Task/TaskDetailDrawer/Updates/TaskDetailsDrawer";
import { PersonValue } from "../Cells/Person/PersonPicker";

import { Board } from "./Board";
import { BoardViewsTabs } from "./BoardViewsTabs";
import { FormBuilder } from "./(board-features)/forms/BoardFeatureForm/FormBuilder/FormBuilder";
import { BoardHeader } from "./BoardHeader";
import { BoardSkeleton } from "./BoardSkeleton";

export default function BoardPage() {
  const { setGroups } = useGroupStore();

  const params = useParams();

  const boardId = Number(params.boardId);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [personFilter, setPersonFilter] =
    useState<PersonValue | null>(null);

  const selectedPersonSearch = personFilter?.users?.[0]
    ? `${personFilter.users[0].firstName ?? ""} ${
        personFilter.users[0].lastName ?? ""
      }`.trim()
    : "";

  /**
   * Debounce normal search.
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  /**
   * Board API
   */
  const {
    data: board,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: [
      "board",
      boardId,
      debouncedSearch,
      selectedPersonSearch,
    ],
    queryFn: () =>
      getBoardDetail(
        boardId,
        debouncedSearch || undefined,
        selectedPersonSearch || undefined,
      ),
    enabled: Number.isFinite(boardId),
    retry: 0,
    placeholderData: keepPreviousData,
  });

  /**
   * Keep groups store synchronized with the currently
   * displayed board.
   */
  useEffect(() => {
    if (board?.groups) {
      setGroups(board.groups);
    }
  }, [board, setGroups]);

  /**
   * Initial board load.
   *
   * There is no previous board to display, so show
   * the skeleton.
   */
  if (isLoading && !board) {
    return (
      <div className="bg-background p-6">
        <BoardSkeleton />
        <TaskDetailsSheet />
      </div>
    );
  }

  /**
   * Board request failed and we have no previous board.
   */
  if (isError && !board) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-background p-6">
        <div className="text-sm text-muted-foreground">
          Board not found.
        </div>

        <TaskDetailsSheet />
      </div>
    );
  }

  /**
   * Invalid / unavailable board.
   */
  if (!board) {
    return (
      <div className="bg-background p-6">
        <BoardSkeleton />
        <TaskDetailsSheet />
      </div>
    );
  }

  return (
    <>
      <div className="relative bg-background p-6">
        {/**
         * Keep the previous board visible while the new board
         * is being fetched.
         */}
        <div
          className={
            isFetching
              ? "pointer-events-none opacity-60 transition-opacity duration-200"
              : "opacity-100 transition-opacity duration-200"
          }
        >
          <BoardHeader board={board} />

          {/* <BoardViewsTabs
            board={board}
            formContent={<FormBuilder board={board} />}
          >
            <Board
              board={board}
              search={search}
              setSearch={setSearch}
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              personFilter={personFilter}
              setPersonFilter={setPersonFilter}
            />
          </BoardViewsTabs> */}
        </div>

        {/**
         * Small loading indicator while switching boards/searching.
         * The previous board stays visible underneath it.
         */}
        {isFetching && (
          <div className="absolute right-6 top-6 z-50 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            Loading board...
          </div>
        )}
      </div>

      <TaskDetailsSheet />
    </>
  );
}