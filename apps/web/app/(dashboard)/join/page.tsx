"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptWorkspaceInviteLink } from "@/services/invitation/invitation.api";

export default function JoinWorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [workspace, setWorkspace] = useState<{ id: number; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-join when token is present and user lands on page
  useEffect(() => {
    if (!token) setState("error");
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    setState("joining");
    try {
      const result = await acceptWorkspaceInviteLink(token);
      setWorkspace(result.workspace);
      setState("joined");
      toast.success(`Joined "${result.workspace.name}"!`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Invalid or expired invite link.";
      setErrorMsg(msg);
      setState("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500/5 via-background to-violet-500/5 p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-background shadow-2xl">
        {/* Header strip */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

        <div className="flex flex-col items-center px-6 py-8 text-center sm:px-8 sm:py-10">
          {state === "idle" && (
            <>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
                <Users className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-xl font-bold text-foreground">You've been invited!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Click below to join the workspace using your current account.
              </p>
              <Button className="mt-6 w-full" onClick={handleJoin}>
                Accept & Join
              </Button>
            </>
          )}

          {state === "joining" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">Joining workspace…</p>
            </>
          )}

          {state === "joined" && workspace && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h1 className="mt-4 text-xl font-bold text-foreground">
                Welcome to "{workspace.name}"!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">You've successfully joined the workspace.</p>
              <Button className="mt-6 w-full" onClick={() => router.push(`/workspace/${workspace.id}`)}>
                Go to workspace
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h1 className="mt-4 text-xl font-bold text-foreground">Link invalid</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {errorMsg || "This invite link is invalid or has expired."}
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => router.push("/dashboard")}>
                Go to dashboard
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
