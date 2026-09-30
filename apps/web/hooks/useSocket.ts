"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

export function useSocket(userId: number | undefined) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    if (!sharedSocket || !sharedSocket.connected) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "";
      sharedSocket = io(`${apiUrl}/chat`, {
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
