"use client";

import { ChevronRight, Search } from "lucide-react";
import { Mail, Phone, Copy } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useDebounce } from "@/services/useDebounce";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { globalSearch } from "@/services/global-search.api";
import { GroupTable } from "../../../group/GroupTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
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
    // enabled: open && debounced.trim().length >= 2,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const [openAddColumn, setOpenAddColumn] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-9/10! overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
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

        <Tabs defaultValue="all" className="flex h-full flex-col">
          <div className="border-b bg-muted/30 px-6 py-3">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>
          </div>

          <div className="h-105  overflow-y-auto">
            <TabsContent value="all" className="mt-0 p-6">
              {query && !isFetching && data && (
                <div className="space-y-8 ">
                  {data.tasks.map((board: any) => (
                    <div key={board.id} className="space-y-6">
                      {board.groups.map((group: any) => (
                        <div
                          key={group.id}
                          className="max-w-full overflow-x-auto scrollbar-none rounded-xl border bg-background"
                        >
                          <div className="border-b bg-muted/30 px-6 py-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-muted-foreground">
                                Workspace
                              </span>

                              <ChevronRight className="h-4 w-4 text-muted-foreground" />

                              <span className="font-medium">{board.name}</span>

                              <ChevronRight className="h-4 w-4 text-muted-foreground" />

                              <span
                                className="font-semibold"
                                style={{ color: group.color ?? undefined }}
                              >
                                {group.name}
                              </span>
                            </div>
                          </div>

                          <GroupTable
                            group={group}
                            columns={board.columns}
                            showSelection={false}
                            showHeaders
                            showNewTaskRow={false}
                            showAddColumn={false}
                            setOpen={setOpenAddColumn}
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                  {data.users.length > 0 && (
                    <div className="rounded-xl border">
                      <div className="border-b px-6 py-3 font-semibold">
                        People
                      </div>

                      {data.users.map((user: any) => (
                        <div
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 px-6 py-3 hover:bg-muted"
                        >
                          <img
                            src={user.avatarUrl || "/avatar.png"}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-9 w-9 rounded-full"
                          />

                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>

                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {data.files.length > 0 && (
                    <div className="rounded-xl border">
                      <div className="border-b px-6 py-3 font-semibold">
                        Files
                      </div>

                      {data.files.map((file: any) => (
                        <div
                          key={file.id}
                          className="cursor-pointer px-6 py-3 hover:bg-muted"
                        >
                          {file.fileName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="tasks" className="mt-0 p-6">
              {data &&
                data.tasks.map((board: any) => (
                  <div key={board.id} className="space-y-6">
                    {board.groups.map((group: any) => (
                      <div
                        key={group.id}
                        className="overflow-hidden rounded-xl border bg-background"
                      >
                        <div className="border-b bg-muted/30 px-6 py-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-muted-foreground">
                              Workspace
                            </span>

                            <ChevronRight className="h-4 w-4 text-muted-foreground" />

                            <span className="font-medium">{board.name}</span>

                            <ChevronRight className="h-4 w-4 text-muted-foreground" />

                            <span
                              className="font-semibold"
                              style={{ color: group.color ?? undefined }}
                            >
                              {group.name}
                            </span>
                          </div>
                        </div>

                        <GroupTable
                          group={group}
                          columns={board.columns}
                          showSelection={false}
                          showHeaders
                          showNewTaskRow={false}
                          showAddColumn={false}
                          setOpen={setOpenAddColumn}
                        />
                      </div>
                    ))}
                  </div>
                ))}
            </TabsContent>
            <TabsContent value="people" className="mt-0 p-6">
              {data && data.users.length > 0 && (
                <div className="rounded-xl border">
                  <div className="border-b px-6 py-3 font-semibold">People</div>

                  <div className="grid gap-8 p-6 sm:grid-cols-3 lg:grid-cols-5">
                    {data.users.map((user: any) => (
                      <div
                        key={user.id}
                        className="relative mt-12 rounded-xl border bg-background px-5 pb-5 pt-14 text-center shadow-sm transition-all hover:shadow-md"
                      >
                        {/* Avatar */}
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                          {/* Blurred background */}
                          <div className="absolute inset-0 scale-125 overflow-hidden rounded-full">
                            <img
                              src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL+user.avatarUrl}
                              alt=""
                              className="h-full w-full scale-105 object-cover blur-xl opacity-70"
                            />
                          </div>

                          {/* Actual profile picture */}
                          <img
                            src={process.env.NEXT_PUBLIC_BACKEND_BASE_URL+user.avatarUrl}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="relative h-24 w-24 rounded-full border-4 border-background object-cover shadow-lg"
                          />
                        </div>

                        {/* Name */}
                        <h3 className="text-lg font-semibold italic mt-4">
                          {user.firstName} {user.lastName}
                        </h3>

                        {/* Optional join date */}
                        <p className="mt-1 text-sm text-muted-foreground">
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                },
                              )
                            : ""}
                        </p>

                        {/* Contact */}
                        <div className="mt-6 space-y-3 text-sm">
                          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border">
                              <Mail className="h-4 w-4" />
                            </div>

                            <span className="flex-1 truncate text-left">
                              {user.email}
                            </span>

                            <button
                              onClick={() =>
                              {
                                navigator.clipboard.writeText(user.email)
                                toast.success("Email copied to clipboard")
                              }
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>

                          {/* <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border">
                              <Phone className="h-4 w-4" />
                            </div>

                            <span className="text-left">
                              {user.phone || user.phoneNumber || "N/A"}
                            </span>
                          </div> */}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="files" className="mt-0 p-6">
              {data && data.files.length > 0 && (
                <div className="rounded-xl border">
                  <div className="border-b px-6 py-3 font-semibold">Files</div>

                  {data.files.map((file: any) => (
                    <div
                      key={file.id}
                      className="cursor-pointer px-6 py-3 hover:bg-muted"
                    >
                      {file.fileName}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
