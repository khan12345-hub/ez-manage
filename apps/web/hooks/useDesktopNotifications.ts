"use client";

import { useCallback, useEffect, useState } from "react";

export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Sync with browser on mount (no auto-request — browsers block it without a user gesture)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setPermission("granted");
      return;
    }
    // Must be called from a click handler so the browser shows the dialog
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const fire = useCallback((title: string, body: string, url?: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (permission !== "granted") return;
    // Tab is active — user can see in-app notification, skip desktop
    if (document.visibilityState === "visible") return;

    try {
      const n = new Notification(title, { body });
      n.onclick = () => {
        if (url) window.location.href = url;
        window.focus();
        n.close();
      };
    } catch {
      // Browser may block in certain contexts (e.g. iframe) — silently ignore
    }
  }, [permission]);

  return { permission, requestPermission, fire };
}
