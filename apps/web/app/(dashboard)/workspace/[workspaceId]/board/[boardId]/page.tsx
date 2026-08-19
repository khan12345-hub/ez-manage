"use client";

import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getBoardDetail } from "@/services/boards.api";
import { useGroupStore } from "@/store/create-group-store";

import { TaskDetailsSheet } from "../Task/TaskDetailDrawer/Updates/TaskDetailsDrawer";
import { Board } from "./Board";
import { PersonValue } from "../Cells/Person/PersonPicker";
import { BoardViewsTabs } from "./BoardViewsTabs";
import { FormBuilder } from "./(board-features)/forms/BoardFeatureForm/FormBuilder/FormBuilder";
import { BoardHeader } from "./BoardHeader";

export default function BoardPage() {
  const { setGroups } = useGroupStore();
  const params = useParams();

  const boardId = Number(params.boardId);

  const [search, setSearch] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [personFilter, setPersonFilter] = useState<PersonValue | null>(null);

  const selectedPersonSearch = personFilter?.users?.[0]
    ? `${personFilter.users[0].firstName ?? ""} ${
        personFilter.users[0].lastName ?? ""
      }`.trim()
    : "";

  /*

* Debounce only the normal search.
*
* Person filter does not need to be combined
* with the search string.
  */
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [search]);

  /*

* Board API
*
* Search and person are sent as separate
* query parameters.
*
* Example:
*
* /api/boards/1
* ?search=working
* &person=Manager%20Ezify
  */
  const {
    data: board,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["board", boardId, debouncedSearch, selectedPersonSearch],

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

  /*

* Keep groups store in sync
  */
  useEffect(() => {
    if (board?.groups) {
      setGroups(board.groups);
    }
  }, [board, setGroups]);

  return (
    <>
      {board && (
        <div className="bg-background p-6">
          <BoardHeader 
          groups={board.groups} 
          boardId={board.id}
          boardName={board.name} columns={board.columns} />
          <BoardViewsTabs
            board={board}
            formContent={<FormBuilder board={board} />}
          >
            <Board
              board={board ?? []}
              search={search}
              setSearch={setSearch}
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              personFilter={personFilter}
              setPersonFilter={setPersonFilter}
            />
          </BoardViewsTabs>
        </div>
      )}
      <TaskDetailsSheet />
    </>
  );
}
