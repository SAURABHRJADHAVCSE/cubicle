"use client";

import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCancelClaudeAuth,
  useClaudeAuthStatus,
  useCompleteClaudeAuth,
  useStartClaudeAuth,
} from "@/hooks/useClaudeAuth";

/**
 * Lets the user connect the Claude Code CLI to their Claude subscription
 * without touching a terminal: starts `claude setup-token` on the server,
 * surfaces the OAuth URL to click, and relays the code they paste back.
 */
export function ClaudeAuthCard() {
  const { data: status, isLoading: statusLoading } = useClaudeAuthStatus();
  const startAuth = useStartClaudeAuth();
  const completeAuth = useCompleteClaudeAuth();
  const cancelAuth = useCancelClaudeAuth();

  const [code, setCode] = useState("");

  function handleConnect() {
    startAuth.mutate(undefined, {
      onSuccess: (data) => {
        window.open(data.auth_url, "_blank", "noopener,noreferrer");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Couldn't start the connection");
      },
    });
  }

  function handleSubmitCode() {
    completeAuth.mutate(code, {
      onSuccess: () => {
        toast.success("Claude Code connected");
        setCode("");
        startAuth.reset();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "That code didn't work — try again");
      },
    });
  }

  const isConnected = Boolean(status?.connected);
  const awaitingCode = startAuth.isSuccess;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Claude Code CLI</CardTitle>
          {!statusLoading && (
            <Badge variant={isConnected ? "secondary" : "outline"} className="gap-1">
              {isConnected ? (
                <CheckCircle2 className="size-3 text-emerald-600" />
              ) : (
                <XCircle className="size-3" />
              )}
              {isConnected ? "Connected" : "Not connected"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your Claude subscription so CLI-engine agents (like Ravi) run on your plan
          instead of pay-per-token API billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!awaitingCode && (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={startAuth.isPending}
            className="w-fit"
          >
            {startAuth.isPending
              ? "Starting…"
              : isConnected
                ? "Reconnect"
                : "Connect Claude Code"}
          </Button>
        )}

        {awaitingCode && startAuth.data && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <p className="text-sm">
              1. Sign in at the tab that just opened (or{" "}
              <a
                href={startAuth.data.auth_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
              >
                open it again <ExternalLink className="size-3" />
              </a>
              ), then paste the code it gives you back here.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claude-auth-code">Authorization code</Label>
              <div className="flex gap-2">
                <Input
                  id="claude-auth-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste the code here"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
                />
                <Button
                  size="sm"
                  onClick={handleSubmitCode}
                  disabled={!code.trim() || completeAuth.isPending}
                >
                  {completeAuth.isPending ? "Connecting…" : "Submit"}
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-fit"
              disabled={cancelAuth.isPending}
              onClick={() => {
                cancelAuth.mutate(undefined, { onSettled: () => startAuth.reset() });
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
