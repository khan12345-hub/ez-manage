"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, Home, Inbox, LayoutGrid, ListChecks, Plus, Settings, UserPlus } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useShortcuts } from "@/providers/ShortcutsProvider";
import { getAllWorkspaces } from "@/services/workspace.api";
import { workApi, workKeys } from "@/services/work.api";
import { useInviteModalStore } from "@/store/invite-modal";
import { useCommandPalette } from "@/store/command-palette";
import { useWorkCreate } from "@/store/work-create";

/** ⌘K for the Work product: only Work spaces, lists and actions — nothing from Boards. */
export function WorkCommandPalette() {
  const open = useCommandPalette((s) => s.paletteOpen);
  const setOpen = useCommandPalette((s) => s.setPaletteOpen);
  const router = useRouter();
  const params = useParams<{ workspaceId?: string }>();
  const ws = String(params.workspaceId ?? "");
  const { register } = useShortcuts();
  const { open: openInvite } = useInviteModalStore();
  const openCreate = useWorkCreate((s) => s.openCreate);

  useEffect(() => {
    const toggle = () => setOpen(!useCommandPalette.getState().paletteOpen);
    const unMeta = register("meta+k", toggle);
    const unCtrl = register("ctrl+k", toggle);
    return () => { unMeta(); unCtrl(); };
  }, [register, setOpen]);

  const { data: tree } = useQuery({ queryKey: workKeys.tree(ws), queryFn: () => workApi.tree(ws), enabled: !!ws && open, staleTime: 30_000 });
  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: getAllWorkspaces, staleTime: 60_000, enabled: open });

  const lists = (tree?.spaces ?? []).flatMap((s) => [
    ...s.lists.map((l) => ({ ...l, path: s.name })),
    ...s.folders.flatMap((f) => f.lists.map((l) => ({ ...l, path: `${s.name} / ${f.name}` }))),
  ]);
  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 80);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Work search" description="Jump to a Work list or action">
      <CommandInput placeholder="Jump to a list, space or action…" autoFocus />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Work">
          <CommandItem value="my work home" disabled={!ws} onSelect={() => run(() => router.push(`/work/${ws}`))}>
            <Home /> My Work
          </CommandItem>
          <CommandItem value="inbox notifications" disabled={!ws} onSelect={() => run(() => router.push(`/work/${ws}/inbox`))}>
            <Inbox /> Inbox
          </CommandItem>
          {tree?.access.canEdit && (
            <CommandItem value="new task create" onSelect={() => run(() => openCreate(null))}>
              <Plus /> New task
            </CommandItem>
          )}
        </CommandGroup>

        {lists.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Lists">
              {lists.map((l) => (
                <CommandItem key={l.uid} value={`list ${l.path} ${l.name}`} onSelect={() => run(() => router.push(`/work/${ws}/list/${l.uid}`))}>
                  <ListChecks />
                  <span className="truncate">{l.name}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">{l.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {(workspaces as any[]).length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workspaces">
              {(workspaces as any[]).map((w: any) => (
                <CommandItem key={w.id} value={`workspace ${w.name}`} onSelect={() => run(() => router.push(`/work/${w.uid ?? w.id}`))}>
                  <Building2 /> {w.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="invite team member" onSelect={() => run(() => openInvite())}>
            <UserPlus /> Invite team member
          </CommandItem>
          <CommandItem value="settings profile" onSelect={() => run(() => router.push("/settings"))}>
            <Settings /> Settings
          </CommandItem>
          <CommandItem value="open product launcher home" onSelect={() => run(() => router.push("/home"))}>
            <LayoutGrid /> Open product launcher
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
