"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Layout,
  MessageSquare,
  Plus,
  Settings,
  UserPlus,
  Zap,
  LayoutDashboard,
  Keyboard,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useShortcuts } from "@/providers/ShortcutsProvider";
import { getAllWorkspaces } from "@/services/workspace.api";
import { getBoards } from "@/services/boards.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { useGroupStore } from "@/store/create-group-store";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const router = useRouter();
  const { register } = useShortcuts();
  const { open: openInvite } = useInviteModalStore();
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  // Register ⌘K / Ctrl+K
  useEffect(() => {
    const unMeta = register("meta+k", () => setOpen(true));
    const unCtrl = register("ctrl+k", () => setOpen(true));
    return () => { unMeta(); unCtrl(); };
  }, [register]);

  // Detect current workspaceId from URL
  useEffect(() => {
    const match = window.location.pathname.match(/\/workspace\/(\d+)/);
    if (match) setWorkspaceId(Number(match[1]));
  }, [open]);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    staleTime: 1000 * 60 * 5,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", workspaceId],
    queryFn: () => getBoards(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5,
  });

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 80); // let dialog close before navigating
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search boards, workspaces, actions…" autoFocus />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => router.push("/dashboard"))}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/dashboard/settings"))}>
            <Settings />
            Settings
            <CommandShortcut>⚙</CommandShortcut>
          </CommandItem>
          {workspaceId && (
            <CommandItem onSelect={() => run(() => router.push(`/workspace/${workspaceId}/chat`))}>
              <MessageSquare />
              Chat
            </CommandItem>
          )}
        </CommandGroup>

        {/* Boards in current workspace */}
        {(boards as any[]).length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Boards">
              {(boards as any[]).map((board: any) => (
                <CommandItem
                  key={board.id}
                  value={`board-${board.id}-${board.name}`}
                  onSelect={() => run(() => router.push(`/workspace/${workspaceId}/board/${board.id}`))}
                >
                  <Layout />
                  {board.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Workspaces */}
        {(workspaces as any[]).length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspaces">
              {(workspaces as any[]).map((ws: any) => (
                <CommandItem
                  key={ws.id}
                  value={`ws-${ws.id}-${ws.name}`}
                  onSelect={() => run(() => router.push(`/workspace/${ws.id}`))}
                >
                  <LayoutDashboard />
                  {ws.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Actions */}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => openInvite())}>
            <UserPlus />
            Invite team member
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
          {workspaceId && (
            <CommandItem onSelect={() => run(() => addNewGroup())}>
              <Plus />
              Add new group to board
              <CommandShortcut>G</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        {/* Shortcuts reference */}
        <CommandSeparator />
        <CommandGroup heading="Keyboard shortcuts">
          <CommandItem disabled>
            <Keyboard />
            Open command palette
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem disabled>
            <Zap />
            New group
            <CommandShortcut>G</CommandShortcut>
          </CommandItem>
          <CommandItem disabled>
            <UserPlus />
            Invite member
            <CommandShortcut>I</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
