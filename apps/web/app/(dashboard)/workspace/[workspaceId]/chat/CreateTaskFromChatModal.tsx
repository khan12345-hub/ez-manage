"use client";

import { useState, useEffect } from "react";
import { ListTodo, X, ChevronDown, Loader2 } from "lucide-react";
import { getBoards, getBoardGroups } from "@/services/boards.api";
import type { BoardGroup } from "@/services/boards.api";
import { createTask } from "@/services/tasks.api";
import { sendChatMessage } from "@/components/Chat/ChatProvider";
import { useAuth } from "@/providers/AuthProvider";
import type { ChatMessage } from "@/services/chat.api";

interface Board {
  id: number;
  name: string;
}

interface Props {
  message: ChatMessage;
  workspaceId: number;
  channelId: number;
  onClose: () => void;
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? d.innerText ?? html).trim();
}

export function CreateTaskFromChatModal({ message, workspaceId, channelId, onClose }: Props) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [taskName, setTaskName] = useState(() =>
    stripHtml(message.content ?? "").slice(0, 120),
  );
  const [creating, setCreating] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    getBoards(workspaceId)
      .then((data: Board[]) => {
        setBoards(data ?? []);
        setLoadingBoards(false);
      })
      .catch(() => setLoadingBoards(false));
  }, [workspaceId]);

  useEffect(() => {
    if (!selectedBoardId) {
      setGroups([]);
      setSelectedGroupId(null);
      return;
    }
    setLoadingGroups(true);
    getBoardGroups(selectedBoardId)
      .then((data) => {
        setGroups(data ?? []);
        if (data?.length) setSelectedGroupId(data[0].id);
        setLoadingGroups(false);
      })
      .catch(() => setLoadingGroups(false));
  }, [selectedBoardId]);

  async function handleCreate() {
    if (!selectedBoardId || !selectedGroupId || !taskName.trim() || creating) return;
    setCreating(true);
    try {
      const task = await createTask(
        { name: taskName.trim(), groupId: selectedGroupId },
        selectedBoardId,
      );
      const creatorName =
        `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
      const payload = JSON.stringify({
        taskId: task.id,
        boardId: selectedBoardId,
        groupId: selectedGroupId,
        taskName: taskName.trim(),
        creatorName,
      });
      sendChatMessage({ channelId, content: `__TASK__:${payload}` });
      onClose();
    } catch {
      setCreating(false);
    }
  }

  const canCreate =
    !!selectedBoardId && !!selectedGroupId && taskName.trim().length > 0 && !creating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold">Create task from message</span>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Task name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Task name
            </label>
            <input
              autoFocus
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              placeholder="Task name…"
            />
          </div>

          {/* Board selector */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Board
            </label>
            {loadingBoards ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading boards…
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) =>
                    setSelectedBoardId(Number(e.target.value) || null)
                  }
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                >
                  <option value="">Select a board…</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Group selector */}
          {selectedBoardId && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Group
              </label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading groups…
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedGroupId ?? ""}
                    onChange={(e) =>
                      setSelectedGroupId(Number(e.target.value) || null)
                    }
                    className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  >
                    <option value="">Select a group…</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ListTodo className="h-4 w-4" />
            )}
            {creating ? "Creating…" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
