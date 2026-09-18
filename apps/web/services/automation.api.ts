import { api } from "@/lib/api";

// ── Trigger payloads ────────────────────────────────────────────────────────
type StatusChangedTrigger = { type: "STATUS_CHANGED"; columnId: number; statusId: number };
type TaskCreatedTrigger   = { type: "TASK_CREATED" };
type DateArrivedTrigger   = { type: "DATE_ARRIVED"; metadata: { dateColumnId: number } };

export type TriggerPayload = StatusChangedTrigger | TaskCreatedTrigger | DateArrivedTrigger;

// ── Action payloads ─────────────────────────────────────────────────────────
type MoveToGroupAction    = { type: "MOVE_TO_GROUP"; groupId: number };
type NotifyMemberAction   = { type: "NOTIFY_MEMBER";   metadata: { target?: string; userIds?: number[] } };
type ChangeStatusAction   = { type: "CHANGE_STATUS";   metadata: { columnId: number; statusOptionId: number } };
type CreateSubitemAction  = { type: "CREATE_SUBITEM";  metadata: { name: string } };
type SetDateAction        = { type: "SET_DATE";        metadata: { columnId: number } };
type SendWhatsappAction   = { type: "SEND_WHATSAPP";   metadata: { target: string; message?: string } };

export type ActionPayload =
  | MoveToGroupAction
  | NotifyMemberAction
  | ChangeStatusAction
  | CreateSubitemAction
  | SetDateAction
  | SendWhatsappAction;

export type CreateAutomationPayload = {
  name: string;
  trigger: TriggerPayload;
  action: ActionPayload;
};

export type AutomationRule = {
  id: number;
  name: string;
  isActive: boolean;
  triggerType: string;
  actionType: string;
  triggerColumnId: number | null;
  triggerStatusId: number | null;
  targetGroupId: number | null;
  triggerMetadata: Record<string, unknown> | null;
  actionMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export async function createAutomation(boardId: number, payload: CreateAutomationPayload) {
  const response = await api.post<AutomationRule>(`/boards/${boardId}/automations`, payload);
  return response.data;
}

export async function getBoardAutomations(boardId: number) {
  const response = await api.get<AutomationRule[]>(`/boards/${boardId}/automations`);
  return response.data;
}

export async function deleteAutomation(boardId: number, automationId: number) {
  const response = await api.delete(`/boards/${boardId}/automations/${automationId}`);
  return response.data;
}

export async function toggleAutomation(boardId: number, automationId: number) {
  const response = await api.patch<AutomationRule>(
    `/boards/${boardId}/automations/${automationId}/toggle`,
  );
  return response.data;
}

export async function updateAutomation(
  boardId: number,
  automationId: number,
  data: CreateAutomationPayload,
) {
  const response = await api.patch(`/boards/${boardId}/automations/${automationId}`, data);
  return response.data;
}
