"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getManagementTeam } from "./management.api";
import { ManagerCard } from "./components/ManagerCard";
import { AddMemberModal } from "./components/AddMemberModal";

interface Props {
  onTaskClick: (task: { taskId: number; taskName: string }) => void;
  onUserClick?: (userId: number) => void;
}

export function ManagementTab({ onTaskClick, onUserClick }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [hiddenExpanded, setHiddenExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ceo-management-team"],
    queryFn: getManagementTeam,
    staleTime: 60_000,
  });

  const handleCardClick = (userId: number) => {
    if (onUserClick) onUserClick(userId);
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Management Team</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "Loading..." : `${data?.members.length ?? 0} visible members`}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Add Member
        </Button>
      </div>

      {/* Active members grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !data || data.members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-semibold text-foreground">No team members yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            OWNERs and ADMINs in your workspaces will appear here.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            Add Member
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.members.map((member) => (
            <ManagerCard
              key={member.userId}
              member={member}
              onClick={() => handleCardClick(member.userId)}
            />
          ))}
        </div>
      )}

      {/* Hidden members collapsible */}
      {data && data.hiddenMembers.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setHiddenExpanded((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-semibold text-muted-foreground">
              {data.hiddenMembers.length} hidden member{data.hiddenMembers.length !== 1 ? "s" : ""}
            </span>
            {hiddenExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {hiddenExpanded && (
            <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-border">
              {data.hiddenMembers.map((member) => (
                <ManagerCard
                  key={member.userId}
                  member={member}
                  hidden
                  onClick={() => handleCardClick(member.userId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
