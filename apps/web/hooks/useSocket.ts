"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

export function useSocket(userId: number | undefined) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    if (!sharedSocket || !sharedSocket.connected) {
      // NEXT_PUBLIC_BACKEND_BASE_URL = e.g. http://localhost:3010 (dev)
      //                                 or https://apimanage.ezify.pk  (prod)
      // Must be a full URL with protocol. If missing/wrong, fall back to
      // relative path so socket.io connects to the current page's origin.
      const raw = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";
      const baseUrl = /^https?:\/\/.+/.test(raw) ? raw : "";
      sharedSocket = io(`${baseUrl}/chat`, {
        auth: { userId },
        transports: ["websocket"],
        autoConnect: true,
      });
    }

    socketRef.current = sharedSocket;

    return () => {
      // Don't disconnect on unmount — keep the shared connection alive
    };
  }, [userId]);

  return socketRef.current ?? sharedSocket;
}
