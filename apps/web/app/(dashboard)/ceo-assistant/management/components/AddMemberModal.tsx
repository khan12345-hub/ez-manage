"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { searchManagementUsers, addToManagementTeam } from "../management.api";

interface Props {
  open: boolean;
  onClose: () => void;
}

function initials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

export function AddMemberModal({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["management-user-search", q],
    queryFn: () => searchManagementUsers(q),
    enabled: open,
    staleTime: 10_000,
  });

  const addMutation = useMutation({
    mutationFn: (memberId: number) => addToManagementTeam(memberId),
    onSuccess: () => {
      toast.success("Member added to management team.");
      queryClient.invalidateQueries({ queryKey: ["ceo-management-team"] });
      onClose();
    },
    onError: () => toast.error("Failed to add member."),
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Add to Management Team</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Search workspace members to add</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-lg border border-border bg-muted/40 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Searching...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {q ? "No members found" : "Type to search members"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {initials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    disabled={addMutation.isPending}
                    onClick={() => addMutation.mutate(user.id)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
