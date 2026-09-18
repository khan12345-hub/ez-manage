"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getBoardDetail } from "@/services/boards.api";
import { trackBoardView } from "@/services/activity-logs";
import { getTask } from "@/services/tasks.api";
import { useGroupStore } from "@/store/create-group-store";
import { useTaskDetailsStore } from "@/store/task-details-store";

import { TaskDetailsSheet } from "../Task/TaskDetailDrawer/Updates/TaskDetailsDrawer";
import { PersonValue } from "../Cells/Person/PersonPicker";

import { Board } from "./Board";
import { BoardViewsTabs } from "./BoardViewsTabs";
import { FormBuilder } from "./(board-features)/forms/BoardFeatureForm/FormBuilder/FormBuilder";
import { BoardHeader } from "./BoardHeader";
import { BoardSkeleton } from "./BoardSkeleton";
import { BoardDocuments } from "./(board-features)/documents/BoardDocuments";
import { FileGallery } from "./(board-features)/file-gallery/FileGallery";
import { ImportProgressBanner } from "./ImportProgressBanner";

export default function BoardPage() {
  const { setGroups } = useGroupStore();
  const openTaskDrawer = useTaskDetailsStore((s) => s.open);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  /**
   * Keep groups store synchronized with the currently
   * displayed board.
   */
  useEffect(() => {
    if (board?.groups) {
      setGroups(board.groups);
    }
  }, [board, setGroups]);

  // Track that this user viewed the board
  useEffect(() => {
    if (board?.id) {
      trackBoardView(board.id);
    }
  }, [board?.id]);

  /**
   * If the URL has ?taskId=X (e.g. clicked from a notification),
   * open the task detail drawer automatically once the board loads.
   */
  const openedFromUrlRef = useRef(false);
  useEffect(() => {
    const taskIdParam = searchParams.get("taskId");

    // Reset ref when URL no longer has taskId — enables re-open on next notification click
    if (!taskIdParam) {
      openedFromUrlRef.current = false;
      return;
    }

    if (openedFromUrlRef.current || !board) return;

    const taskId = Number(taskIdParam);
    if (!Number.isFinite(taskId)) return;

    openedFromUrlRef.current = true;

    // Try to find the task in already-loaded board groups first
    let groupId: number | undefined;
    for (const group of board.groups ?? []) {
      const found = (group.tasks ?? []).find((t: any) => t.id === taskId);
      if (found) { groupId = group.id; break; }
    }

    const open = (gId?: number) => {
      openTaskDrawer({ taskId, boardId, groupId: gId });
      // Remove ?taskId from URL without triggering a navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("taskId");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    };

    if (groupId) {
      open(groupId);
    } else {
      // Task not in current board view (filters active) — fetch directly
      getTask(taskId, boardId)
        .then((task: any) => open(task?.groupId))
        .catch(() => open(undefined));
    }
  }, [board, searchParams, boardId, openTaskDrawer, router]);

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
        <div className="text-sm text-muted-foreground">Board not found.</div>

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
      <div className="relative bg-background p-3 sm:p-6">
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

          <ImportProgressBanner boardId={boardId} />

          <BoardViewsTabs
            board={board}
            formContent={<FormBuilder board={board} />}
            documentContent={<BoardDocuments />}
            fileGalleryContent={<FileGallery />}
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
          </BoardViewsTabs>
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
