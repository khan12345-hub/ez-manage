"use client";

import { ChevronDown, Bot, Bell, MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { InviteModal } from "@/components/InviteModal";
import { useInviteModalStore } from "@/store/invite-modal";
interface Props {
  board: any;
}

export function BoardTitle({ board }: Props) {
  const { setWorkspace, setBoard, workspaceId, setWorkspaceRole } = useInviteModalStore();

  useEffect(() => {
    setWorkspace(workspaceId);
    // setWorkspaceRole
    setBoard(board.id);
  }, [board]);
  const open = useInviteModalStore((s) => s.open);
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-medium tracking-tight">{board.name}</h1>

          <Button variant="ghost" size="icon">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost">
            <Share2 className="mr-2 h-4 w-4" />
            AI suggestions
          </Button>

          <Button variant="ghost">Integrate</Button>

          <Button variant="ghost">Automate</Button>

          <Button variant="ghost">
            <Bot className="mr-2 h-4 w-4" />
            Agents
          </Button>

          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
          </Button>

          <Button onClick={open}>Invite</Button>

          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <InviteModal/>
    </>
  );
}
