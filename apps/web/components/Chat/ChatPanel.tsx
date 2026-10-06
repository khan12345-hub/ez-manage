"use client";

import { useChatStore } from "@/store/chat-store";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";

export function ChatPanel() {
  const { isChatOpen, activeChannelId, channels, dms, toggleChat } = useChatStore();

  if (!isChatOpen) return null;

  const allChannels = [...channels, ...dms];
  const activeChannel = allChannels.find((c) => c.id === activeChannelId) ?? null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex h-[520px] w-[720px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
      <ChatSidebar onClose={toggleChat} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeChannel ? (
          <ChatWindow channel={activeChannel} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Select a channel or conversation
          </div>
        )}
      </div>
    </div>
  );
}
