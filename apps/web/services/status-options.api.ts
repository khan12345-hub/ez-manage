import { api } from "@/lib/api";

export interface UpdateStatusOptionPayload {
  label?: string;
  color?: string;
//   order?: number;
}

export interface CreateStatusOptionPayload {
  label: string;
  color: string;
//   order: number;
}

export async function updateStatusOption(
  columnId: number,
  statusOptionId: number,
  payload: UpdateStatusOptionPayload,
) {
  const { data } = await api.patch(
    `/board-columns/${columnId}/status-options/${statusOptionId}`,
    payload,
  );

  return data;
}

export async function createStatusOption(
  columnId: number,
  payload: CreateStatusOptionPayload,
) {
  const { data } = await api.post(
    `/board-columns/${columnId}/status-options`,
    payload,
  );

  return data;
}

export async function deleteStatusOption(
  columnId: number,
  statusOptionId: number,
) {
  const { data } = await api.delete(
    `/board-columns/${columnId}/status-options/${statusOptionId}`,
  );

  return data;
}