"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { getBoardDetail } from "@/services/boards.api";
import { FormBuilder } from "./BoardFeatureForm/FormBuilder";

export default function NewFormPage() {
  const params = useParams();

  const boardId = Number(params.boardId);

  const {
    data: board,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => getBoardDetail(boardId),
    enabled: Number.isFinite(boardId),
    retry: 0,
  });

  if (isLoading) {
    return <div>Loading board...</div>;
  }

  if (isError || !board) {
    return <div>Failed to load board.</div>;
  }

  return (
    <FormBuilder
      board={board}
    />
  );
}

