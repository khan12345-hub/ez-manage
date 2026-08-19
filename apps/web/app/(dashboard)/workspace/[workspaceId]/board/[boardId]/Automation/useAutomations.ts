import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createAutomation,
  deleteAutomation,
  getBoardAutomations,
  toggleAutomation,
  updateAutomation,
  type CreateAutomationPayload,
} from "@/services/automation.api";
export function useUpdateAutomation(
  boardId: number,
) {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: ({
      automationId,
      data,
    }: {
      automationId: number;

      data: {
        name: string;

        trigger: {
          type: string;
          columnId: number;
          statusId: number;
        };

        action: {
          type: string;
          groupId: number;
        };
      };
    }) =>
      updateAutomation(
        boardId,
        automationId,
        data,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "automations",
          boardId,
        ],
      });
    },
  });
}
export const automationKeys = {
  all: ["automations"] as const,

  board: (boardId: number) =>
    [...automationKeys.all, "board", boardId] as const,
};

export function useBoardAutomations(
  boardId: number,
) {
  return useQuery({
    queryKey: automationKeys.board(boardId),
    queryFn: () =>
      getBoardAutomations(boardId),
    enabled: Boolean(boardId),
  });
}

export function useCreateAutomation(
  boardId: number,
) {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (
      payload: CreateAutomationPayload,
    ) =>
      createAutomation(
        boardId,
        payload,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey:
          automationKeys.board(
            boardId,
          ),
      });
    },
  });
}

export function useDeleteAutomation(
  boardId: number,
) {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (
      automationId: number,
    ) =>
      deleteAutomation(
        boardId,
        automationId,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey:
          automationKeys.board(
            boardId,
          ),
      });
    },
  });
}

export function useToggleAutomation(
  boardId: number,
) {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (
      automationId: number,
    ) =>
      toggleAutomation(
        boardId,
        automationId,
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey:
          automationKeys.board(
            boardId,
          ),
      });
    },
  });
}