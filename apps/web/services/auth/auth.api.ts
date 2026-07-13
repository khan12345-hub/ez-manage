import { api } from "@/lib/api";
import { LoginDto, SetupAccountDto } from "@repo/shared";

export async function login(data: LoginDto) {
  const response = await api.post("/auth/login", data);
  return response.data;
}

export async function getMe() {
  const response = await api.get("/auth/me");
  return response.data;
}
export async function logout() {
  await api.post("/auth/logout");
}

export async function setUpAccount(data: SetupAccountDto) {
  await api.post(`/auth/setup-account`, data);
}
