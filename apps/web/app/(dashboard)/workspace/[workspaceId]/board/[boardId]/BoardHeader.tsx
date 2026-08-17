"use client";

import {
  Bot,
  ChevronDown,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
// import AutomationModal from "./Automation/AutomationModal";
// import { AutomationGroup } from "./Automation/AutomationBuilder";

interface BoardHeaderProps {
  boardName: string;
  columns: any;
  memberCount?: number;
  onInvite?: () => void;
  onCopyLink?: () => void;
  onBoardMenu?: () => void;
  // groups: AutomationGroup[];
}

export function BoardHeader({
  boardName,
  columns,
  // groups,
  memberCount = 2,
  onInvite,
  onCopyLink,
  onBoardMenu,
}: BoardHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex h-16 w-full items-center justify-between bg-background px-6">
      {/* Left */}
      <button type="button" className="flex items-center gap-1.5 text-left">
        <span className="text-2xl capitalize font-semibold tracking-[-0.02em]">
          {boardName}
        </span>

        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* AI suggestions */}
        {/* <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3 font-normal"
        >
          <Sparkles className="h-4 w-4" />
          <span>AI suggestions</span>

          <span className="rounded-[4px] border border-blue-500 px-1.5 py-0.5 text-[10px] font-medium leading-none text-blue-600">
            New
          </span>
        </Button> */}

        {/* Integrate */}
        {/* <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3 font-normal"
        >
          <Settings2 className="h-4 w-4" />
          <span>Integrate</span>
        </Button> */}

        {/* Automate */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3 font-normal"
          // onClick={() => setOpen(true)}
        >
          <Bot className="h-4 w-4" />
          <span>Automate</span>
        </Button>

        {/* <AutomationModal
          open={open}
          onOpenChange={setOpen}
          boardName={boardName}
          columns={columns}
          groups={groups}
        /> */}

        {/* Agents */}
        {/* <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 px-3 font-normal"
          >
            <WandSparkles className="h-4 w-4" />
            <span>Agents</span>
          </Button>

          <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-blue-500" />
        </div> */}

        {/* Messages */}

        {/* More */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onBoardMenu}
          className="ml-1 h-9 w-9"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
