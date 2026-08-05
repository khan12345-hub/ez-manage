"use client";

import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useDebounce } from "@/services/useDebounce";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { globalSearch } from "@/services/global-search.api";


interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchModal({
  open,
  onOpenChange,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");

  const debounced = useDebounce(query, 300);

  const params = useParams();

  const workspaceId = Number(params.workspaceId);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", workspaceId, debounced],
    queryFn: () => globalSearch(workspaceId, debounced),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[1200px]! overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">Global Search</DialogTitle>

        <div className="border-b bg-white px-6 py-5">
          <div className="relative">
            <Search className="absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400" />

            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, boards, users, files..."
              className="h-12 border-0 pl-10 pr-4 text-lg shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 border-b bg-gray-50 px-6 py-3">
          <button className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white">
            All
          </button>

          <button className="rounded-full px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200">
            Tasks
          </button>

          <button className="rounded-full px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200">
            Boards
          </button>

          <button className="rounded-full px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200">
            Groups
          </button>

          <button className="rounded-full px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200">
            People
          </button>

          <button className="rounded-full px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-200">
            Files
          </button>
        </div>

        <div className="h-[420px] overflow-y-auto">
          {!query && (
            <div className="flex h-full flex-col items-center justify-center px-8">
              <Search className="mb-4 h-14 w-14 text-gray-300" />

              <h3 className="text-lg font-semibold text-gray-900">
                Search across EzManage
              </h3>

              <p className="mt-2 max-w-md text-center text-sm text-gray-500">
                Search tasks, boards, groups, people, and files from anywhere
                in your workspace.
              </p>
            </div>
          )}

          {query && isFetching && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Searching...
            </div>
          )}

          {query &&
            !isFetching &&
            data &&
            data.tasks.length === 0 &&
            data.boards.length === 0 &&
            data.groups.length === 0 &&
            data.users.length === 0 &&
            data.files.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No results found.
              </div>
            )}

          {query && !isFetching && data && (
            <div className="space-y-6 p-6">
              {data.tasks.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-500">
                    Tasks
                  </h4>

                  {data.tasks.map((task: any) => (
                    <div
                      key={task.id}
                      className="cursor-pointer rounded-lg p-3 transition hover:bg-gray-100"
                    >
                      <div className="font-medium">{task.name}</div>

                      <div className="text-sm text-gray-500">
                        {task.group.board.name} • {task.group.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.boards.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-500">
                    Boards
                  </h4>

                  {data.boards.map((board: any) => (
                    <div
                      key={board.id}
                      className="cursor-pointer rounded-lg p-3 transition hover:bg-gray-100"
                    >
                      {board.name}
                    </div>
                  ))}
                </div>
              )}

              {data.groups.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-500">
                    Groups
                  </h4>

                  {data.groups.map((group: any) => (
                    <div
                      key={group.id}
                      className="cursor-pointer rounded-lg p-3 transition hover:bg-gray-100"
                    >
                      <div>{group.name}</div>
                      <div className="text-sm text-gray-500">
                        {group.board.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.users.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-500">
                    People
                  </h4>

                  {data.users.map((user: any) => (
                    <div
                      key={user.id}
                      className="cursor-pointer rounded-lg p-3 transition hover:bg-gray-100"
                    >
                      <div>
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {data.files.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-gray-500">
                    Files
                  </h4>

                  {data.files.map((file: any) => (
                    <div
                      key={file.id}
                      className="cursor-pointer rounded-lg p-3 transition hover:bg-gray-100"
                    >
                      {file.fileName}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-3 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="rounded border bg-white px-1.5 py-0.5">↑</kbd>{" "}
              <kbd className="rounded border bg-white px-1.5 py-0.5">↓</kbd>{" "}
              Navigate
            </span>

            <span>
              <kbd className="rounded border bg-white px-1.5 py-0.5">
                Enter
              </kbd>{" "}
              Select
            </span>
          </div>

          <span>
            <kbd className="rounded border bg-white px-1.5 py-0.5">Esc</kbd>{" "}
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}