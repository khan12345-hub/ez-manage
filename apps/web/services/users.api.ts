// services/users.api.ts

import { api } from "@/lib/api";

export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  systemRole: "USER" | "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
}

export async function getAllUsers(search?: string): Promise<AdminUser[]> {
  const { data } = await api.get("/users", {
    params: search ? { search } : undefined,
  });
  return data;
}

export interface CreateUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  systemRole: "USER" | "SUPER_ADMIN";
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const { data } = await api.post("/users", payload);
  return data;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  systemRole?: "USER" | "SUPER_ADMIN";
  newPassword?: string;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUser> {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export interface NotificationPreferences {
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<NotificationPreferences>(
    "/users/me/notification-preferences",
  );
  return data;
}

export async function updateNotificationPreferences(
  payload: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await api.patch<NotificationPreferences>(
    "/users/me/notification-preferences",
    payload,
  );
  return data;
}

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
