import { api } from "@/lib/api";

export async function getVapidPublicKey(): Promise<string> {
  const { data } = await api.get("/push/vapid-public-key");
  return data.key as string;
}

export async function subscribePush(
  subscription: PushSubscriptionJSON,
): Promise<void> {
  await api.post("/push/subscribe", subscription);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.delete("/push/unsubscribe", { data: { endpoint } });
}

/** Convert VAPID base64url public key to Uint8Array for pushManager.subscribe() */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
