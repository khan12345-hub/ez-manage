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

interface BoardHeaderProps {
  boardName: string;
  memberCount?: number;
  onInvite?: () => void;
  onCopyLink?: () => void;
  onBoardMenu?: () => void;
}

export function BoardHeader({
  boardName,
  memberCount = 2,
  onInvite,
  onCopyLink,
  onBoardMenu,
}: BoardHeaderProps) {
  return (
    <header className="flex h-16 w-full items-center justify-between bg-background px-6">
      {/* Left */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-left"
      >
        <span className="text-2xl capitalize font-semibold tracking-[-0.02em]">
          {boardName}
        </span>

        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* AI suggestions */}
        <Button
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
        </Button>

        {/* Integrate */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3 font-normal"
        >
          <Settings2 className="h-4 w-4" />
          <span>Integrate</span>
        </Button>

        {/* Automate */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-3 font-normal"
        >
          <Bot className="h-4 w-4" />
          <span>Automate</span>
        </Button>

        {/* Agents */}
        <div className="relative">
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
        </div>

        {/* Messages */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-1 h-9 w-9"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>

        {/* Avatar */}
        <Avatar className="ml-2 h-7 w-7">
          <AvatarImage src="" />
          <AvatarFallback className="text-xs">
            ME
          </AvatarFallback>
        </Avatar>

        {/* Invite */}
        <div className="ml-3 flex items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onInvite}
            className="h-9 rounded-r-none border-r-0 px-3 font-normal"
          >
            <Users className="mr-1.5 h-4 w-4" />
            Invite / {memberCount}
          </Button>

          {/* Copy link */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCopyLink}
            className="h-9 w-9 rounded-l-none"
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>

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