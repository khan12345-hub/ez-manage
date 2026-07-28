import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createTaskComment,
} from "@/services/comments.api";

export function useCreateTaskComment(
  taskId: number,
) {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: ({
      content,
      files,
    }: {
      content: string;
      files: File[];
    }) =>
      createTaskComment(
        taskId,
        {
          content,
          files,
        },
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "task-comments",
          taskId,
        ],
      });
    },
  });
}