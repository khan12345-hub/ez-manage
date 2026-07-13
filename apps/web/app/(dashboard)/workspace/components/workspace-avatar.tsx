"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  name: string;
}

export function WorkspaceAvatar({ name }: Props) {
  return (
    <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
      <AvatarFallback className="bg-violet-500 text-5xl font-semibold text-white">
        {name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
}