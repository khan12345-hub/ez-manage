"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  urlBase64ToUint8Array,
} from "@/services/push.api";

type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

const SW_PATH = "/sw.js";
const STORAGE_KEY = "push_subscribed";

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(false);

  // Determine initial state from browser
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const perm = Notification.permission;
    if (perm === "denied") { setState("denied"); return; }
    if (perm === "granted" && localStorage.getItem(STORAGE_KEY) === "1") {
      setState("subscribed");
    } else {
      setState("default");
    }
  }, []);

  const enable = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }

      const reg = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) throw new Error("VAPID key not configured on server");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await subscribePush(sub.toJSON() as PushSubscriptionJSON);
      localStorage.setItem(STORAGE_KEY, "1");
      setState("subscribed");
    } catch (err) {
      console.error("[Push] subscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
      }
      localStorage.removeItem(STORAGE_KEY);
      setState("default");
    } catch (err) {
      console.error("[Push] unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, loading, enable, disable };
}
