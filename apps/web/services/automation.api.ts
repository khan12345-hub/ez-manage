import { api } from "@/lib/api";

export type CreateAutomationPayload = {
  name: string;

  trigger: {
    type: "STATUS_CHANGED";
    columnId: number;
    statusId: number;
  };

  action: {
    type: "MOVE_TO_GROUP";
    groupId: number;
  };
};

export type AutomationRule = {
  id: number;
  name: string;
  isActive: boolean;

  triggerType: "STATUS_CHANGED";
  actionType: "MOVE_TO_GROUP";

  triggerColumnId: number | null;
  triggerStatusId: number | null;
  targetGroupId: number | null;

  createdAt: string;
  updatedAt: string;
};

export async function createAutomation(
  boardId: number,
  payload: CreateAutomationPayload,
) {
  const response = await api.post<AutomationRule>(
    `/boards/${boardId}/automations`,
    payload,
  );

  return response.data;
}

export async function getBoardAutomations(
  boardId: number,
) {
  const response = await api.get<AutomationRule[]>(
    `/boards/${boardId}/automations`,
  );

  return response.data;
}

export async function deleteAutomation(
  boardId: number,
  automationId: number,
) {
  const response = await api.delete(
    `/boards/${boardId}/automations/${automationId}`,
  );

  return response.data;
}

export async function toggleAutomation(
  boardId: number,
  automationId: number,
) {
  const response = await api.patch<AutomationRule>(
    `/boards/${boardId}/automations/${automationId}/toggle`,
  );

  return response.data;
}

export async function updateAutomation(
  boardId: number,
  automationId: number,
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
  },
) {
  const response =
    await api.patch(
      `/boards/${boardId}/automations/${automationId}`,
      data,
    );

  return response.data;
}