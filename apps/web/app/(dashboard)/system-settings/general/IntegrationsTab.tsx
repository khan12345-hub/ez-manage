"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getIntegrations, updateIntegrations } from "@/services/admin.api";

export function IntegrationsTab() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "integrations"],
    queryFn: getIntegrations,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data) {
      setToken(data.mondayApiToken ?? "");
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateIntegrations({ mondayApiToken: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
      setDirty(false);
      toast.success("Monday.com API token saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Failed to save token");
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Configure third-party service credentials.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <Plug className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Monday.com</CardTitle>
              <CardDescription className="text-xs">
                Used to download files from Monday.com board imports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="monday-token">API Token</Label>
            <div className="relative">
              {isLoading ? (
                <div className="flex h-10 items-center rounded-md border bg-muted px-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Input
                  id="monday-token"
                  type={showToken ? "text" : "password"}
                  placeholder="eyJhbGciOiJIUzI1NiJ9..."
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setDirty(true);
                  }}
                  className="pr-10 font-mono text-xs"
                />
              )}
              {!isLoading && (
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Get your token from{" "}
              <span className="font-medium text-foreground">
                Monday.com → Profile → Admin → API
              </span>
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!dirty || saveMutation.isPending || isLoading}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
