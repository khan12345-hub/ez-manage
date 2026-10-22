"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getEmailHistory, retryEmail } from "@/services/ceo-assistant.api";
import { cn } from "@/lib/utils";

function HistoryRow({
  item,
  onRetry,
  retrying,
}: {
  item: Awaited<ReturnType<typeof getEmailHistory>>["items"][0];
  onRetry: (id: number) => void;
  retrying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const success = item.deliveryStatus === "sent";
  const failed = item.deliveryStatus === "failed";
  const pending = item.deliveryStatus === "pending";
  const initials = `${item.recipient.firstName[0] ?? ""}${item.recipient.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={item.recipient.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {item.recipient.firstName} {item.recipient.lastName}
            </span>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {item.recipient.email}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{item.subject}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : pending ? (
            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          {failed && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(item.id); }}
              disabled={retrying}
              title="Retry sending"
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date(item.sentAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Email body
          </p>
          <pre className="text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed">
            {item.body}
          </pre>
        </div>
      )}
    </div>
  );
}

export function EmailHistoryTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ceo-email-history", page],
    queryFn: () => getEmailHistory(page, 20),
    staleTime: 30_000,
    refetchInterval: (query) => {
      // Auto-refresh while any item is pending
      const hasPending = query.state.data?.items.some((i) => i.deliveryStatus === "pending");
      return hasPending ? 4_000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (historyId: number) => {
      setRetryingId(historyId);
      return retryEmail(historyId);
    },
    onSuccess: () => {
      toast.success("Retry queued — check back in a moment.");
      queryClient.invalidateQueries({ queryKey: ["ceo-email-history"] });
    },
    onError: () => toast.error("Failed to queue retry."),
    onSettled: () => setRetryingId(null),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data || !data.items) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">Failed to load email history.</p>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">No emails sent yet.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Send your first batch from the Email Center tab.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted-foreground">
          {data.total} total email{data.total !== 1 ? "s" : ""} sent
        </span>
      </div>

      {data.items.map((item) => (
        <HistoryRow
          key={item.id}
          item={item}
          onRetry={(id) => retryMutation.mutate(id)}
          retrying={retryingId === item.id && retryMutation.isPending}
        />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
