import { api } from "@/lib/api";

import {
  CreateTemplatePayload,
} from "@/app/(dashboard)/workspace/[workspaceId]/settings/board-template/template.types";

export async function getBoardTemplates() {
  const { data } = await api.get("/board-templates");

  return data;
}

export async function getBoardTemplate(
  templateId: number,
) {
  const { data } = await api.get(
    `/board-templates/${templateId}`,
  );

  return data;
}

export async function createBoardTemplate(
  payload: CreateTemplatePayload,
) {
  const { data } = await api.post(
    "/board-templates",
    payload,
  );

  return data;
}

export async function updateBoardTemplate(
  templateId: number,
  payload: Partial<CreateTemplatePayload>,
) {
  const { data } = await api.patch(
    `/board-templates/${templateId}`,
    payload,
  );

  return data;
}

export async function deleteBoardTemplate(
  templateId: number,
) {
  const { data } = await api.delete(
    `/board-templates/${templateId}`,
  );

  return data;
}