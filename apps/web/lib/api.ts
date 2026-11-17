import axios from "axios";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
})

// Pages a logged-out visitor must be able to open (a 401 there is expected, not a reason to leave)
const PUBLIC_PATHS = ["/login", "/auth/", "/setup-account", "/form/", "/guest/", "/wf/", "/wl/"];

/**
 * A 401 only means "signed out" when the session is really gone. While the API restarts
 * (deploys, dev reloads) requests can fail or briefly answer 401 — so before sending anyone
 * to /login, ask /auth/me a few times; network errors and 5xx never log anyone out.
 */
let checking: Promise<boolean> | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sessionGone(): Promise<boolean> {
  let unauthorized = 0;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/auth/me`, { credentials: "include", cache: "no-store" });
      if (r.ok) return false;
      if (r.status === 401) { if (++unauthorized >= 2) return true; }
      // 5xx / 502 while the API boots: keep waiting
    } catch {
      // API not reachable (restarting): keep waiting, never log out for this
    }
    await sleep(1500 * (i + 1));
  }
  return false;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== "undefined" &&
      !PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))
    ) {
      checking ??= sessionGone().finally(() => { setTimeout(() => { checking = null; }, 5000); });
      if (await checking) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
