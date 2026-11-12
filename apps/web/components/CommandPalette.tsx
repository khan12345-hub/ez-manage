"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Settings,
  SquareKanban,
  TrendingUp,
  UserPlus,
  Building2,
  CalendarDays,
  Clock,
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
import { useAuth } from "@/providers/AuthProvider";
import { getAllWorkspaces } from "@/services/workspace.api";
import { getBoards } from "@/services/boards.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { useGroupStore } from "@/store/create-group-store";
import { useCommandPalette } from "@/store/command-palette";
import { useProductAccess } from "@/hooks/useProductAccess";

/** Product dot — same colours as the sidebar switcher and the home cards. */
function Dot({ className }: { className: string }) {
  return <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${className}`} />;
}

export function CommandPalette() {
  const open = useCommandPalette((s) => s.paletteOpen);
  const setOpen = useCommandPalette((s) => s.setPaletteOpen);
  const setTaskSearchOpen = useCommandPalette((s) => s.setTaskSearchOpen);

  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { register } = useShortcuts();
  const { open: openInvite } = useInviteModalStore();
  const addNewGroup = useGroupStore((s) => s.addNewGroup);

  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";

  // Workspace and board URLs carry uid strings, not numeric ids.
  const workspaceUid = pathname?.match(/\/workspace\/([^/]+)/)?.[1] ?? null;
  const onBoard = /\/board\/[^/]+/.test(pathname ?? "");

  useEffect(() => {
    const toggle = () => setOpen(!useCommandPalette.getState().paletteOpen);
    const unMeta = register("meta+k", toggle);
    const unCtrl = register("ctrl+k", toggle);
    return () => { unMeta(); unCtrl(); };
  }, [register, setOpen]);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getAllWorkspaces,
    staleTime: 60_000,
  });

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", workspaceUid],
    queryFn: () => getBoards(workspaceUid!),
    enabled: !!workspaceUid,
    staleTime: 60_000,
  });

  const firstWorkspaceUid = (workspaces as any[])[0]?.uid ?? (workspaces as any[])[0]?.id;
  const boardsHome = workspaceUid ?? firstWorkspaceUid;
  const products = useProductAccess();

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 80); // let the dialog close before navigating
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a product, board or action"
    >
      <CommandInput placeholder="Jump to a board, workspace or action…" autoFocus />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {workspaceUid && (
          <CommandGroup heading="Search">
            <CommandItem
              value="search tasks in this workspace"
              onSelect={() => run(() => setTaskSearchOpen(true))}
            >
              <Search />
              Search tasks in this workspace…
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Products">
          {products.hasBoards && (
            <CommandItem
              value="product boards"
              disabled={!boardsHome}
              onSelect={() => run(() => router.push(`/workspace/${boardsHome}`))}
            >
              <Dot className="bg-product-boards" />
              Boards
              <CommandShortcut>Workspaces</CommandShortcut>
            </CommandItem>
          )}
          {products.hasWork && products.workHref && (
            <CommandItem
              value="product work spaces lists tasks"
              onSelect={() => run(() => router.push(products.workHref!))}
            >
              <Dot className="bg-product-work" />
              Work
              <CommandShortcut>Spaces & lists</CommandShortcut>
            </CommandItem>
          )}
          {products.hasCeo && (
            <CommandItem value="product ceo control tower" onSelect={() => run(() => router.push("/ceo"))}>
              <Dot className="bg-product-ceo" />
              CEO Tower
              <CommandShortcut>Portfolio</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem value="home" onSelect={() => run(() => router.push("/home"))}>
            <Home />
            Home
          </CommandItem>
          <CommandItem value="dashboard my work" onSelect={() => run(() => router.push("/dashboard"))}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
          {workspaceUid && (
            <>
              <CommandItem value="workspace calendar" onSelect={() => run(() => router.push(`/workspace/${workspaceUid}/calendar`))}>
                <CalendarDays />
                Workspace calendar
              </CommandItem>
              <CommandItem value="my timesheet" onSelect={() => run(() => router.push(`/workspace/${workspaceUid}/timesheet`))}>
                <Clock />
                My timesheet
              </CommandItem>
              <CommandItem value="team chat" onSelect={() => run(() => router.push(`/workspace/${workspaceUid}/chat`))}>
                <MessageSquare />
                Team chat
              </CommandItem>
            </>
          )}
          <CommandItem value="settings profile" onSelect={() => run(() => router.push("/settings"))}>
            <Settings />
            Settings
          </CommandItem>
        </CommandGroup>

        {(boards as any[]).length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Boards in this workspace">
              {(boards as any[]).map((board: any) => (
                <CommandItem
                  key={board.id}
                  value={`board ${board.name} ${board.id}`}
                  onSelect={() => run(() => router.push(`/workspace/${workspaceUid}/board/${board.uid ?? board.id}`))}
                >
                  <SquareKanban />
                  {board.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {(workspaces as any[]).length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspaces">
              {(workspaces as any[]).map((ws: any) => (
                <CommandItem
                  key={ws.id}
                  value={`workspace ${ws.name} ${ws.id}`}
                  onSelect={() => run(() => router.push(`/workspace/${ws.uid ?? ws.id}`))}
                >
                  <Building2 />
                  {ws.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="invite team member" onSelect={() => run(() => openInvite())}>
            <UserPlus />
            Invite team member
          </CommandItem>
          {onBoard && (
            <CommandItem value="add new group to board" onSelect={() => run(() => addNewGroup())}>
              <Plus />
              Add a group to this board
            </CommandItem>
          )}
          <CommandItem value="open home launcher" onSelect={() => run(() => router.push("/home"))}>
            <LayoutGrid />
            Open product launcher
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          ↑↓ to move · Enter to open
        </span>
        <span className="font-mono">⌘K / Ctrl K</span>
      </div>
    </CommandDialog>
  );
}
