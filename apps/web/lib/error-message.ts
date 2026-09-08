import axios from "axios";

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return "You don't have permission to perform this action.";
    }
    const msg = error.response?.data?.message;
    if (msg) return Array.isArray(msg) ? msg.join(", ") : msg;
  }
  return fallback;
}
