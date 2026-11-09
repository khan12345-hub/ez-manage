"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS, workApi, workKeys, type WorkComment } from "@/services/work.api";

/** Emoji reactions under a comment: chips with counts (mine highlighted) + add. */
export function Reactions({ comment, currentUserId }: { comment: WorkComment; currentUserId?: number }) {
  const list = comment.reactions ?? [];
  const toggle = useReact(comment, currentUserId);

  const groups = REACTION_EMOJIS.map((e) => ({ emoji: e, people: list.filter((r) => r.emoji === e) })).filter((g) => g.people.length);
  if (!groups.length) return null; // adding lives in the comment's hover toolbar
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {groups.map((g) => {
        const mine = g.people.some((r) => r.userId === currentUserId);
        return (
          <button
            key={g.emoji}
            type="button"
            aria-pressed={mine}
            aria-label={`${g.emoji} ${g.people.length}`}
            title={g.people.map((r) => (r.userId === currentUserId ? "You" : `${r.user.firstName} ${r.user.lastName}`.trim())).join(", ")}
            onClick={() => toggle.mutate(g.emoji)}
            className={cn(
              "flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] transition-colors",
              mine ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            <span className="text-[13px] leading-none">{g.emoji}</span>
            <span className="font-medium tabular-nums">{g.people.length}</span>
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Add reaction" title="Add reaction" className="flex h-6 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground">
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="grid w-auto grid-cols-6 gap-0.5 p-1.5">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} type="button" aria-label={`React ${e}`} onClick={() => toggle.mutate(e)} className="h-8 w-8 rounded-md text-[18px] hover:bg-accent">{e}</button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** toggle my reaction on a comment, instantly (cache first, server confirms) */
export function useReact(comment: WorkComment, currentUserId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => workApi.react(comment.id, emoji),
    // instant: flip it in the cache, the server confirms after
    onMutate: async (emoji) => {
      const key = workKeys.comments(comment.taskId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WorkComment[]>(key);
      qc.setQueryData<WorkComment[]>(key, (old) =>
        old?.map((c) => {
          if (c.id !== comment.id) return c;
          const mine = (c.reactions ?? []).some((r) => r.emoji === emoji && r.userId === currentUserId);
          return {
            ...c,
            reactions: mine
              ? (c.reactions ?? []).filter((r) => !(r.emoji === emoji && r.userId === currentUserId))
              : [...(c.reactions ?? []), { emoji, userId: currentUserId ?? 0, user: { id: currentUserId ?? 0, firstName: "You", lastName: "" } }],
          };
        }),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("Couldn't react.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: workKeys.comments(comment.taskId) }),
  });
}
