import { uploadTaskCellFiles } from "@/services/tasks.api";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

export function useUploadTaskCellFiles() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: ({
      boardId,
      cellId,
      files,
    }: {
      boardId: number;
      cellId: number;
      files: File[];
    }) =>
      uploadTaskCellFiles(
        boardId,
        cellId,
        files,
      ),

    onSuccess: (
      _data,
      variables,
    ) => {
      queryClient.invalidateQueries({
        queryKey: [
          "board",
          variables.boardId,
        ],
      });
    },
  });
}