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