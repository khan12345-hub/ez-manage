import axios from "axios";

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
})

// Pages a logged-out visitor must be able to open (a 401 there is expected, not a reason to leave)
const PUBLIC_PATHS = ["/login", "/auth/", "/setup-account", "/form/", "/guest/"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== "undefined" &&
      !PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))
    ) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    return Promise.reject(error);
  }
);