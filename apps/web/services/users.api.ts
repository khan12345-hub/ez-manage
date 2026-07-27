// services/users.api.ts

import { api } from "@/lib/api";

export const getUserByEmail = async (email: string) => {
  const { data } = await api.get("/users/by-email", {
    params: {
      email,
    },
  });

  return data;
};

export interface UpdateUserSettingsPayload {
  firstName: string;
  lastName: string;
  currentPassword?: string;
  newPassword?: string;
  avatar?: File | null;
}

export async function updateUserSettings(
  payload: UpdateUserSettingsPayload,
) {
  const formData = new FormData();

  if (payload.firstName !== undefined) {
    formData.append(
      "firstName",
      payload.firstName,
    );
  }

  if (payload.lastName !== undefined) {
    formData.append(
      "lastName",
      payload.lastName,
    );
  }

  if (payload.currentPassword) {
    formData.append(
      "currentPassword",
      payload.currentPassword,
    );
  }

  if (payload.newPassword) {
    formData.append(
      "newPassword",
      payload.newPassword,
    );
  }

  if (payload.avatar) {
    formData.append(
      "avatar",
      payload.avatar,
    );
  }

  const { data } = await api.patch(
    "/users/me/settings",
    formData,
  );

  return data;
}
