"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getBoardDetail } from "@/services/boards.api";
import { Board } from "../Board";

export default function BoardPage() {
  const params = useParams<{ id: string }>();
  const boardId = Number(params.id);

  const {
    data: board,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoardDetail(boardId),
    enabled: Number.isFinite(boardId),
    retry:0
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading board...
      </div>
    );
  }

  if (isError || !board) {
    return (
      <div className="flex h-screen items-center justify-center">
        Board not found.
      </div>
    );
  }

  return (
    <div className="bg-background p-6">
      <Board board={board} />
    </div>
  );
}