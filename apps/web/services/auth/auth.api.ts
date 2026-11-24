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
  return (await api.post(`/auth/setup-account`, data)).data as { alreadyExists?: boolean; email?: string; message?: string };
}

export async function forgotPassword(data: { email: string }) {
  const response = await api.post("/auth/forgot-password", data);
  return response.data;
}

export async function resetPassword(data: { token: string; password: string }) {
  const response = await api.post("/auth/reset-password", data);
  return response.data;
}

// ───────────────────────── MFA (two-step verification) ─────────────────────────
export type MfaStatus = { totp: boolean; email: boolean; enabled: boolean; required: boolean; enrolledAt: string | null; recoveryLeft: number };

// login challenge (the password step returned { mfaRequired, methods })
export async function mfaVerify(code: string) {
  return (await api.post("/auth/mfa/verify", { code })).data;
}
export async function mfaSendCode() {
  return (await api.post("/auth/mfa/send-code")).data as { sent: boolean };
}

// managing your own MFA (signed in)
export async function mfaGetStatus() {
  return (await api.get("/auth/mfa/status")).data as MfaStatus;
}
export async function mfaBeginTotp() {
  return (await api.post("/auth/mfa/totp/begin")).data as { secret: string; otpauth: string };
}
export async function mfaConfirmTotp(code: string) {
  return (await api.post("/auth/mfa/totp/confirm", { code })).data as { enabled: boolean; recoveryCodes: string[] };
}
export async function mfaEnableEmail() {
  return (await api.post("/auth/mfa/email/enable")).data as { enabled: boolean; recoveryCodes: string[] | null };
}
export async function mfaDisable(which: "totp" | "email" | "all") {
  return (await api.post("/auth/mfa/disable", { which })).data as MfaStatus;
}
export async function mfaRegenerateRecovery() {
  return (await api.post("/auth/mfa/recovery/regenerate")).data as { recoveryCodes: string[] };
}
